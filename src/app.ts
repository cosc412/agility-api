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
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,userid,projectid,sprintid');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });

  const port = process.env.PORT || 3000;

  // User Routes
  app.post('/users', async (req: Request, res: Response) => {
    try {
      const token = req.body.token;
      const user = await agility.validateUser(token);
      res.status(200).send(user);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.get('/users/:userID', async (req: Request, res: Response) => {
    try {
      const id = req.params.userID;
      const roles = await agility.getAllMemberStatus(id);
      res.status(200).send(roles);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  })

  app.get('/users/:userID/projects/:projID', async (req: Request, res: Response) => {
    try {
      const userID = req.params.userID;
      const projID = req.params.projID;
      const member = await agility.getMemberStatus(userID, projID);
      res.status(200).send(member);
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
      const id = req.header('userid') || '';
      const projects = await agility.getUsersProjects(id);
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
  });

  app.patch('/projects/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const params = {
        name: req.body.name,
        description: req.body.description
      }
      await agility.updateProject(id, params);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  // Sprint Routes
  app.get('/sprints', async (req: Request, res: Response) => {
    try {
      const pID = req.header('projectid') || '';
      const sprints = await agility.getSprints(pID);
      res.status(200).send(sprints);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.get('/sprints/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const sprint = await agility.getSprintByID(id);
      res.status(200).send(sprint);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.post('/sprints', async (req: Request, res: Response) => {
    try {
      const params = {
        projID: req.body.projID,
        header: req.body.header,
        due: new Date(req.body.due),
        description: req.body.description
      };
      const sID = await agility.createSprint(params);
      res.status(201).send(sID);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.patch('/sprints/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const params = {
        projID: req.body.projID,
        header: req.body.header,
        due: new Date(req.body.due),
        description: req.body.description
      };
      await agility.updateSprint(id, params);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.delete('/sprints/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      await agility.deleteSprint(id);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  // Task Routes
  app.get('/tasks', async (req: Request, res: Response) => {
    try {
      const sID = req.header('sprintid') || '';
      const tasks = await agility.getSprintTasks(sID);
      res.status(200).send(tasks);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.get('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const task = await agility.getSprintTask(id);
      res.status(200).send(task);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.post('/tasks', async (req: Request, res: Response) => {
    try {
      const sID = req.body.sprintID;
      const params = {
        due: new Date(req.body.due),
        header: req.body.header,
        description: req.body.description
      };
      const id = await agility.createTask(sID, params);
      res.status(201).send(id);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.patch('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const params = {
        sID: req.body.sprintID,
        due: new Date(req.body.due),
        header: req.body.header,
        description: req.body.description,
        block: req.body.block,
        note: req.body.note
      };
      await agility.updateTask(id, params);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.delete('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      await agility.deleteTask(id);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  // Notes and Blocks Routes
  app.post('/tasks/:taskID/notes', async (req: Request, res: Response) => {
    try {
      const tID = req.params.taskID;
      const notes = req.body.notes;
      await agility.updateNote(tID, notes);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.post('/tasks/:taskID/blocks', async (req: Request, res: Response) => {
    try {
      const tID = req.params.taskID;
      const blocks = req.body.blocks;
      await agility.updateBlock(tID, blocks);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}