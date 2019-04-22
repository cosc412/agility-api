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
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,userid');
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
      const project = await agility.createProject(params);
      res.status(201).send(project._id);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.get('/projects/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const project = await agility.getProjectByID(id);
      res.status(200).send(project);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.get('/projects', async (req: Request, res: Response) => {
    try {
      const projects = await agility.getUsersProjects(req.header('userid'));
      res.status(200).send(projects);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.delete('/projects/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      await agility.deleteProject(id);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  })

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}