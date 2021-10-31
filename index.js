  var AWS = require('aws-sdk'),
      region = process.env.AWS_REGION,
      secretName = secretName,
      secret,
      decodedBinarySecret;
      


const s3 = new AWS.S3()

exports.handler = async function(event) {
  return s3.listBuckets().promise()
}

// inside handler
exports.handler = (event, context) => {
    let secret = "WordPressTest"
    let params = {
        "SecretId": secret
    }
    var secretsmanager = new AWS.SecretsManager();
    const request = secretsmanager.getSecretValue(params, function(err, data) {
       if (err) console.log(err, err.stack); // an error occurred
       else     console.log(data);           // successful response
   });
    
    request.on('success', function(response) {
    const value = JSON.parse(response.data.SecretString);
    console.log(value);
    sendResponse(event, context, 'SUCCESS', { 'Message': 'Resource creation successful!',  "host": value.host, "user": value.username, "dbpass": value.password});
    })
    .on('error', function(error, response) {
        sendResponse(event, context, 'FAILED');
    });

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
