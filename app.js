// creating variables to use libraries
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

mongoose.connect("mongodb+srv://jason:codeide1@logicpatch.gvlmw.mongodb.net/LogicPatch", {useNewUrlParser: true});

// schema - sets up collections within the database
// user schema
const userSchema = new mongoose.Schema({
    username: String,
    name: String,
    email: String,
    password: String,
    accountType: String,
    key: String
});
// setup for passport
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
    teamKey: String,
    availablePlayers: [userSchema],
    unavailablePlayers: [userSchema]
});
const Event = mongoose.model("Event", eventSchema);

// today's date as a string
var today = new Date();
var dd = String(today.getDate()).padStart(2, '0');
var mm = String(today.getMonth() + 1).padStart(2, '0');
var yyyy = today.getFullYear();
today = yyyy + '-' + mm + '-' + dd;

//GETS
// loads homepage differently depending on whether the user is signed in
app.get("/", (req, res)=>{
    if(req.isAuthenticated()){
        res.render("mainpage", {authentication: true});
    } else{
        res.render("mainpage", {authentication: false});
    }
    
});
// loads signin page
app.get("/signin", (req, res)=>{
    res.render("signin");
});
// loads signin page with error message
app.get("/signin-error", (req, res)=>{
    res.render("signin-error");
});
// loads signup page
app.get("/signup", (req, res)=>{
    res.render("signup", {errorMessage: ""});
});
// loads homepage
app.get("/homepage", (req, res)=>{
    // checks if user is logged in
    if(req.isAuthenticated()){
        // checks if the user is a player or coach account and whether their key is given or not
        if(req.user.key === ""){
            // players initial signup
            res.render("enterKey", {errorMessage: ""});
        } else{
            // if user belongs to a team, direct them to homepage
            Event.find({teamKey: req.user.key}, (err, foundEvents)=>{
                Team.findOne({key: req.user.key}, (err, foundTeam)=>{
                    // passes data needed to the team homepage and renders it
                    res.render("homepage", {currentUser: req.user, foundEvents: foundEvents, today: today, numberOfPlayers: foundTeam.players.length});
                })
            })   
        }
    } else{
        // redirect user to signin if they're not logged in
        res.redirect("/signin");
    }
});
// loads teamlist page
app.get("/teamlist", (req, res)=>{
    // check if user is logged in
    if(req.isAuthenticated()){
        Team.findOne({key: req.user.key}, (err, foundTeam)=>{
            // passes data needed to the teamlist page and renders it
            User.findOne({username: foundTeam.coach}, (err, foundCoach)=>{
                res.render("teamlist", {currentUser: req.user, teamKey: req.user.key, coach: foundCoach, players: foundTeam.players});
            });
        });
    } else{
        // redirect user to signin if they're not logged in
        res.redirect("/signin")
    }
});
// loads calendar page
app.get("/calendar", (req, res)=>{
    // check if the user is logged in
    if(req.isAuthenticated()){
        Event.find({teamKey: req.user.key}, (err, foundEvents)=>{
            // passes all the events to the event page and renders it
            res.render("calendar", {events: foundEvents});
        })  
    } else{
        // redirect user to signin if they're not logged in
        res.redirect("/signin");
    }
});
// loads 404 error page
app.get("/:notFound", (req, res)=>{
    res.render("404");
});

// POSTS
// logic for signup process
app.post("/signup", (req, res)=>{
    // gets all user detials from the signup page
    const username = req.body.username;
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const confirmedPassword = req.body.cPassword;
    const accountType = req.body.accountType;
    const uid = new ShortUniqueId({ length: 6 });
    var key = "";
    var team = "";

    // generates a new team if coach account is created
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
        // checks if their is name input
        if(name == ""){
            res.render("signup", {errorMessage: "No name was given"});
        } else{
            // checks if the email is in correct email format
            if(email == "" || !emailValidation(email) || result != null){
                res.render("signup", {errorMessage: "Email is in use or invalid"});
            } else{
                // password strength check (one cap, one non-cap, and one number)
                if(!(/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password))){
                    res.render("signup", {errorMessage: "Password must include one capital and non-capital letter and one number"});
                } else{
                    // checks if the confirmed password and password fields match
                    if(password != confirmedPassword){
                        res.render("signup", {errorMessage: "Password do not match"});
                    } else{
                        // checks if user has given account type input
                        if(accountType === undefined){
                            res.render("signup", {errorMessage: "No account type was given"});
                        } else{
                            // validation with database
                            User.register({username: username, name: name, email: email, accountType: accountType, key: key}, password, (err, user)=>{
                                if(err){
                                    // checks if username is already in use
                                    res.render("signup", {errorMessage: err.message});
                                } else{
                                    // if the user signed up as a coach, add the team created earlier to the database
                                    if(accountType === "coach"){
                                        team.save();
                                    }
                                    // if all above error-checks have been passed, add user to the database
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
// logic for login process
app.post('/signin', passport.authenticate('local', { successRedirect: '/homepage', failureRedirect: '/signin-error', failureFlash: true}));
// player account key enter
app.post("/enterKey", (req, res)=>{
    const enteredKey = req.body.key;
    // checks if user given key is valid and if it is, add them to the team
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
                // redirect user to the homepage
                res.redirect("/homepage");
            } else{
                // render invalid message and refresh page
                res.render("enterKey", {errorMessage: "Invalid key, please ask your coach for the team page key"});
            }
        }
    });
});
// logs user out
app.post("/logout", (req, res)=>{
    req.logout();
    // redirects user to mainpage
    res.redirect("/");
});
// create new event
app.post("/createEvent", (req, res)=>{
    // gets all event details from the create event modal page
    const eventTitle = req.body.eventTitle;
    const eventDescription = req.body.eventDescription;
    const attendance = req.body.attendance;
    const opposingTeam = req.body.opposingTeam;
    const date = req.body.date;
    const location = req.body.location;
    // creates new event object with given input
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
    // adds data to database
    event.save();
    // refresh page
    res.redirect("/homepage");
});
// adds player to available list under event
app.post("/canAttend", (req, res)=>{
    const eventId = req.body.eventId;
    // removes user from unavailable list if they're on it and adds them to the available list
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
    // refresh page
    res.redirect("/homepage");
});
// adds player to unavailable list under event
app.post("/cannotAttend", (req, res)=>{
    const eventId = req.body.eventId;
    // removes user from availble list if they're on it and adds them to the unavailable list
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
    // refresh page
    res.redirect("/homepage");
});
// logic for deleting events - coach accounts only
app.post("/deleteEvent", (req, res)=>{
    const eventId = req.body.eventId;

    Event.findByIdAndDelete(eventId, (err)=>{
        if(err){
            console.log(err);
        }
    });
    res.redirect("/homepage");
});
// logic for removing players - coach accounts only
app.post("/removePlayer", (req, res)=>{
    const playerId = req.body.playerId;
    // finds the user within the database and clear their key
    User.findByIdAndUpdate(playerId, {key: ""}, (err)=>{
        if(err){
            console.log(err);
        }
    });
    // removes the player from the team they were in within the database
    Team.findOne({key: req.user.key}, (err, foundTeam)=>{
        for(var i = 0; i < foundTeam.players.length; i++){
            if(foundTeam.players[i].id == playerId){
                foundTeam.players.splice(i, i+1);
                foundTeam.save();
            }
        }
    });
    // refresh page
    res.redirect("/teamlist");
});

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