$(document).ready(function() {
    $('#calendar').evoCalendar({
      theme: 'Midnight Blue'
    })


    for (var i = 0; i < $('#eventsLength').data('config'); i++) {
      var eventTitle = $('#eventTitle' + i).data('config');
      var eventDescription = $('#eventDescription' + i).data('config');
      var eventDate = $('#eventDate' + i).data('config');

      var formattedEventDate = eventDate.substring(5, 7) + "/" + eventDate.substring(8) + "/" + eventDate.substring(0,4);

      $('#calendar').evoCalendar('addCalendarEvent', {
        name: eventTitle,
        description: eventDescription,
        date: formattedEventDate
      });
    }
    
    
});