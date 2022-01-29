// initiates calendar
$(document).ready(function() {
    // set theme for calendar
    $('#calendar').evoCalendar({
      theme: 'Midnight Blue'
    })
    // adding events to the calendar
    for (var i = 0; i < $('#eventsLength').data('config'); i++) {
      var eventTitle = $('#eventTitle' + i).data('config');
      var eventDescription = $('#eventDescription' + i).data('config');
      var eventDate = $('#eventDate' + i).data('config');
      var attendance = $('#attendance' + i).data('config');
      // changes the eventColor depending on if attendance is true or false
      var eventColor;
      if(attendance){
        eventColor = '#03b300';
      } else{
        eventColor = '#9e0d00';
      }
      // reformatting the date to match with evo calendar necessary date input
      var formattedEventDate = eventDate.substring(5, 7) + "/" + eventDate.substring(8) + "/" + eventDate.substring(0,4);
      // adds the event to the calendar
      $('#calendar').evoCalendar('addCalendarEvent', {
        name: eventTitle,
        description: eventDescription,
        date: formattedEventDate,
        color: eventColor
      });
    }
    
    
});