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

  // Needed to be able to connect to the client
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });

  const port = process.env.PORT || 3000;

  // User Routes
  app.post('/users', async (req: Request, res: Response) => {
    try {
      const token = req.body.token;
      const params = {
        name: req.body.name,
        email: req.body.email,
        profileURL: req.body.profileURL
      };
      const user = await agility.validateUser(token, params);
      res.status(200).send(user);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  // Project Routes
  app.post('/projects', async (req: Request, res: Response) => {
    try {
      const params = {
        name: req.body.name,
        description: req.body.description,
        userID: req.body.userID
      };
      await agility.createProject(params);
      res.sendStatus(201);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}