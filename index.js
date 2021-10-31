var mysql = require('mysql');


function create_connection(db_host, db_user, master_db_pass) {
    var connection = mysql.createConnection({
      host     : db_host,
      user     : db_user,
      password : master_db_pass
    });
    
    connection.connect();
    
    return connection;
    
}


function generate_password(len) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < len; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * 
 charactersLength));
   }
   return result;
}


function execute_query(query, connection) {
    connection.query(query, function(err, rows, fields) {
        if(err) throw err;
    });
  
}


exports.handler = function (event, context, callback) {
    console.log("LOGGING");
    console.log(event.ResourceProperties);
    
    let stack = event.ResourceProperties.stack;
    let user = event.ResourceProperties.stack;
    let db_host = event.ResourceProperties.host;
    let db_user = event.ResourceProperties.db_user;
    let master_db_pass = event.ResourceProperties.db_pass;
    
    const connection = create_connection(db_host, db_user, master_db_pass);
    
    const admin_pass = generate_password(8);
    const db_pass = generate_password(24);

    setupWatchdogTimer(event, context, callback);
    if (event.RequestType === 'Create') {
      // Create database
      let query = "CREATE DATABASE " + stack;
      execute_query(query, connection);
      //create user
      query = "CREATE USER '" + user + "'@'%' IDENTIFIED BY '" + db_pass + "';";
      execute_query(query, connection);
      //Grant access 
      query = "GRANT ALL PRIVILEGES ON " + stack + ". * TO '" + user + "'@'%';";
      execute_query(query, connection);
      
      // Flush privileges
      query = "FLUSH PRIVILEGES;";
      execute_query(query, connection);
      // Close Database connection.
      connection.end();
      sendResponse(event, context, 'SUCCESS', { 'Message': 'Resource creation successful!',  'admin_pass': admin_pass, 'db_pass': db_pass });
  }
    else if (event.RequestType === 'Delete') {
      // Create database
      let query = "DROP DATABASE " + stack;
      execute_query(query, connection);
      //create user
      query = "DROP USER '" + user + "'@'%';";
      execute_query(query, connection);
      // Close Database connection.
      connection.end();
      sendResponse(event, context, 'SUCCESS', { 'Message': 'Resource creation successful!',  'admin_pass': admin_pass, 'db_pass': db_pass });
  }

}



function setupWatchdogTimer (event, context, callback) {
  const timeoutHandler = () => {
    console.log('Timeout FAILURE!')
    // Emit event to 'sendResponse', then callback with an error from this
    // function
    new Promise(() => sendResponse(event, context, 'FAILED'))
      .then(() => callback(new Error('Function timed out')))
  }

  // Set timer so it triggers one second before this function would timeout
  setTimeout(timeoutHandler, context.getRemainingTimeInMillis() - 1000)
}

// Send response to the pre-signed S3 URL
function sendResponse (event, context, responseStatus, responseData) {
  console.log('Sending response ' + responseStatus)
  var responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: 'See the details in CloudWatch Log Stream: ' + context.logStreamName,
    PhysicalResourceId: context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData
  })

  console.log('RESPONSE BODY:\n', responseBody)

  var https = require('https')
  var url = require('url')

  var parsedUrl = url.parse(event.ResponseURL)
  var options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: 'PUT',
    headers: {
      'content-type': '',
      'content-length': responseBody.length
    }
  }

  console.log('SENDING RESPONSE...\n')

  var request = https.request(options, function (response) {
    console.log('STATUS: ' + response.statusCode)
    console.log('HEADERS: ' + JSON.stringify(response.headers))
    // Tell AWS Lambda that the function execution is done
    context.done()
  })

  request.on('error', function (error) {
    console.log('sendResponse Error:' + error)
    // Tell AWS Lambda that the function execution is done
    context.done()
  })

  // write data to request body
  request.write(responseBody)
  request.end()
}
