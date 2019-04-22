import { MongoClient } from "mongodb";
import { AgilityDatastore } from "./datastore";
import * as express from 'express';
import * as morgan from 'morgan';
import { Request, Response } from 'express';

const bodyParser = require('body-parser');

AgilityDatastore
  .connect()
  .then((client: MongoClient) => {
    const ordersDatastore = new AgilityDatastore(client);
    startServer(ordersDatastore);
  });

function startServer(agility: AgilityDatastore) {
  const app = express();

  app.use(morgan('dev'));

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  const port = process.env.PORT || 3000;

  // User Routes
  app.post('/users', async (req: Request, res: Response) => {
    
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}