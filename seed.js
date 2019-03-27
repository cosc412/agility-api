const MongoClient = require('mongodb').MongoClient;
const URL = "mongodb+srv://sean:cosc484demo@cluster0-vdsaa.mongodb.net/test?retryWrites=true"

MongoClient.connect(URL, async (err, client) => {
  if (err) throw err;
  client.db().collection('')
  client.close();
});