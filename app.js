const express = require('express');
const app = express();
const port = 3000; 
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const ShortUniqueId = require('short-unique-id');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportLocalMongoose = require('passport-local-mongoose');
const flash = require('connect-flash');

app.use(flash());

// ejs and body-parser setup
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.set('view engine', 'ejs');
// passport setup
app.use(session({
    secret: "logicpatch",
    resave: false,
    saveUninitialized: true
}))
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/LogicPatch", {useNewUrlParser: true});
// mongoose.connect("mongodb+srv://jason:codeide1@logicpatch.gvlmw.mongodb.net/LogicPatch", {useNewUrlParser: true});

// user schema
const userSchema = new mongoose.Schema({
    username: String,
    name: String,
    email: String,
    password: String,
    accountType: String,
    key: String
});
userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("User", userSchema);
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
// team schema
const teamSchema = new mongoose.Schema({
    key: String,
    coach: String,
    players: [userSchema]
})
const Team = mongoose.model("Team", teamSchema);
// individual event schema
const eventSchema = new mongoose.Schema({
    eventTitle: String,
    eventDescription: String,
    attendance: Number,
    opposingTeam: String,
    date: String,
    location: String,
    availablePlayers: [userSchema],
    unavailablePlayers: [userSchema]
});
const Event = mongoose.model("Event", eventSchema);

// VARIABLES
var today = new Date();
var dd = String(today.getDate()).padStart(2, '0');
var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
var yyyy = today.getFullYear();
today = yyyy + '-' + mm + '-' + dd;

//GETS
app.get("/", (req, res)=>{
    if(req.isAuthenticated()){
        res.render("mainpage", {authentication: true});
    } else{
        res.render("mainpage", {authentication: false});
    }
    
})
app.get("/:notFound", (req, res)=>{
    res.render("404");
})
app.get("/signin", (req, res)=>{
    res.render("signin", {errorMessage: ""});
})
app.get("/signup", (req, res)=>{
    res.render("signup", {errorMessage: ""});
})
app.get("/homepage", (req, res)=>{
    // checks if user is authenticated
    if(req.isAuthenticated()){
        // checks if the user is a player or coach account and whether their key is given or not
        if(req.user.key === ""){
            // players
            res.render("enterKey", {errorMessage: ""});
        } else{
            // coach
            Event.find({teamKey: req.user.key}, (err, foundEvents)=>{
                res.render("homepage", {currentUser: req.user, foundEvents: foundEvents, today: today});
            })   
        }
    } else{
        res.redirect("/signin");
    }
})
app.get("/teamlist", (req, res)=>{
    if(req.isAuthenticated()){
        Team.findOne({key: req.user.key}, (err, foundTeam)=>{
            User.findOne({username: foundTeam.coach}, (err, foundCoach)=>{
                res.render("teamlist", {teamKey: req.user.key, coach: foundCoach, players: foundTeam.players});
            });
        });
    } else{
        res.redirect("/signin")
    }
})
app.get("/calendar", (req, res)=>{
    if(req.isAuthenticated()){
        Event.find({teamKey: req.user.key}, (err, foundEvents)=>{
            res.render("calendar", {events: foundEvents});
        })  
    } else{
        res.redirect("/signin");
    }
})
//POSTS
app.post("/signup", (req, res)=>{
    const username = req.body.username;
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const confirmedPassword = req.body.cPassword;
    const accountType = req.body.accountType;
    const uid = new ShortUniqueId({ length: 6 });
    var key = "";
    var team = "";

    // generates a new key if coach account is created
    if(accountType === "coach"){
        key = uid();
        Team.exists({key: key}, (err, result)=>{
            while(result){
                key = uid();
            }
            team = new Team({
                key: key,
                coach: username,
                players: []
            });
        })
    }
    // signup form error checking
    User.exists({email: email}, (err, result)=>{
        if(name == ""){
            res.render("signup", {errorMessage: "No name was given"});
        } else{
            if(email == "" || !emailValidation(email) || result != null){
                res.render("signup", {errorMessage: "Email is in use or invalid"});
            } else{
                if(!(/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password))){
                    res.render("signup", {errorMessage: "Password must include one capital and non-capital letter and one number"});
                } else{
                    if(password != confirmedPassword){
                        res.render("signup", {errorMessage: "Password do not match"});
                    } else{
                        if(accountType === undefined){
                            res.render("signup", {errorMessage: "No account type was given"});
                        } else{
                            User.register({username: username, name: name, email: email, accountType: accountType, key: key}, password, (err, user)=>{
                                if(err){
                                    res.render("signup", {errorMessage: err.message});
                                } else{
                                    if(accountType === "coach"){
                                        team.save();
                                    }
                                    passport.authenticate("local")(req, res, ()=>{
                                        res.redirect("/homepage");
                                    })
                                }
                            })
                        }
                    }
                }   
            }
        }
    })
});
// login error check
app.post('/signin', passport.authenticate('local', { successRedirect: '/homepage', failureRedirect: '/signin', failureFlash: true}));
// player account key enter
app.post("/enterKey", (req, res)=>{
    const enteredKey = req.body.key;

    Team.findOne({key: enteredKey}, (err, foundTeam)=>{
        if(err){
            console.log(err);
        } else{
            // checks if there is a made team with the given key
            if(foundTeam){
                // adds the key to the user details
                req.user.key = enteredKey;
                req.user.save();
                // adds the user to the team list
                foundTeam.players.push(req.user);
                foundTeam.save();
                
                res.redirect("/homepage");
            } else{
                // render invalid message
                res.render("enterKey", {errorMessage: "Invalid key, please ask your coach for the team page key"});
            }
        }
    });
});
// logs user out
app.post("/logout", (req, res)=>{
    req.logout();
    res.redirect("/");
});
// create new event
app.post("/createEvent", (req, res)=>{
    const eventTitle = req.body.eventTitle;
    const eventDescription = req.body.eventDescription;
    const attendance = req.body.attendance;
    const opposingTeam = req.body.opposingTeam;
    const date = req.body.date;
    const location = req.body.location;
    // creates new event with given input
    const event = new Event({
        teamKey: req.user.key,
        eventTitle: eventTitle,
        eventDescription: eventDescription,
        attendance: attendance,
        opposingTeam: opposingTeam,
        date: date,
        location: location,
        availablePlayers: [],
        unavailablePlayers: []
    })
    event.save();

    res.redirect("/homepage");
})
// adds player to available list under event
app.post("/canAttend", (req, res)=>{
    const eventId = req.body.eventId;

    Event.findById(eventId, (err, foundEvent)=>{
        if(foundEvent){
            const index = foundEvent.unavailablePlayers.findIndex(user => user.id === req.user.id);
            if(index != -1){
                foundEvent.unavailablePlayers.splice(index, 1);
            }
            foundEvent.availablePlayers.push(req.user);
            foundEvent.save();
        }
    })

    res.redirect("/homepage");
})
// adds player to unavailable list under event
app.post("/cannotAttend", (req, res)=>{
    const eventId = req.body.eventId;

    Event.findById(eventId, (err, foundEvent)=>{
        if(foundEvent){
            const index = foundEvent.availablePlayers.findIndex(user => user.id === req.user.id);
            if(index != -1){
                foundEvent.availablePlayers.splice(index, 1);
            }
            foundEvent.unavailablePlayers.push(req.user);
            foundEvent.save();
        }
    })

    res.redirect("/homepage");
})

// validates the user entered email
function emailValidation(email){
    var emailPattern = /^[^ ]+@[^ ]+\.[a-z]{2,3}$/;

    if(email.match(emailPattern)){
        return true;
    } else{
        return false;
    }
}
// finds all players on a team
function findPlayers(key, callback){
    Team.findOne({key: key}, (err, foundTeam)=>{
        if(err){
            console.log(err);
        } else{
            callback(null, foundTeam.players);
        }
    });
}

app.listen(process.env.PORT || 3000, () => {
    console.log(`Example app listening at http://localhost:${port}`)
});