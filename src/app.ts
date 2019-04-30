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
    res.setHeader('Access-Control-Allow-Origin', 'http://www.agile-projects.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,projectid,sprintid,authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });

  const port = process.env.PORT || 3000;

  // User Routes
  app.post('/users', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const userIDs = req.body.userIDs;
      if (!userIDs || userIDs.length === 0) {
        res.status(400).send(new Error('There must be at least one user ID to find'));
      }

      const users = await agility.getUsersFromList(userIDs);
      res.status(200).send(users);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.post('/users/validate', async (req: Request, res: Response) => {
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
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

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
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const userID = req.params.userID;
      const projID = req.params.projID;
      const canRead = await agility.getMemberStatus(auth['sub'], projID);

      if (!canRead) {
        res.status(403).send(new Error('You are unauthorized to see this project'));
      }

      const member = await agility.getMemberStatus(userID, projID);
      res.status(200).send(member);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.delete('/users/:userID/projects/:projID', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const userID = req.params.userID;
      const projID = req.params.projID;
      const canDelete = await agility.getMemberStatus(auth['sub'], projID);

      if (!canDelete || canDelete.role === 'Developer') {
        res.status(403).send(new Error('You are unauthorized to remove team members from this project'));
      }

      await agility.removeTeamMember(userID, projID);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  // Project Routes
  app.post('/projects', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const params = {
        name: req.body.name,
        description: req.body.description,
        userID: auth['sub']
      };
      if (params.name === undefined || params.description === undefined || params.userID === undefined) {
        res.status(400).send(new Error('You must have a project name, description, and your userID'));
      }
      
      const project = await agility.createProject(params);
      res.status(201).send(project._id);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.get('/projects/:id', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const id = req.params.id;
      const canRead = await agility.getMemberStatus(auth['sub'], id);
      if (!canRead) {
        res.status(403).send(new Error('You are unauthorized to see this project'));
      }

      const project = await agility.getProjectByID(id);
      res.status(200).send(project);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.get('/projects', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const projects = await agility.getUsersProjects(auth['sub']);
      res.status(200).send(projects);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.delete('/projects/:id', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const id = req.params.id;
      const canDelete = await agility.getMemberStatus(auth['sub'], id);
      if (!canDelete || canDelete.role === 'Developer') {
        res.status(403).send(new Error('You are unauthorized to delete this project'));
      }

      await agility.deleteProject(id);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.patch('/projects/:id', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const id = req.params.id;
      const params = {
        name: req.body.name,
        description: req.body.description
      }
      if (params.name === undefined || params.description === undefined) {
        res.status(400).send(new Error('You must include a project name and description'));
      }

      const canUpdate = await agility.getMemberStatus(auth['sub'], id);
      if (!canUpdate || canUpdate.role === 'Developer') {
        res.status(403).send(new Error('You are unauthorized to update this project'));
      }

      await agility.updateProject(id, params);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.get('/projects/:id/team', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const id = req.params.id;
      const canRead = await agility.getMemberStatus(auth['sub'], id);
      if (!canRead) {
        res.status(403).send(new Error('You are unauthorized to see this project team'));
      }

      const team = await agility.getProjectTeam(id);
      res.status(200).send(team);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.post('/projects/:id/team', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const id = req.params.id;
      const params = {
        email: req.body.email
      };
      if (params.email === undefined) {
        res.status(400).send(new Error('You must include a email in the request'));
      }

      const canCreate = await agility.getMemberStatus(auth['sub'], id);
      if (!canCreate || canCreate.role === 'Developer') {
        res.status(403).send(new Error('You are unauthorized to add users to this project'));
      }

      await agility.addUserToTeam(id, params);
      res.sendStatus(201);
    } catch (e) {
      console.error(e);
      res.send(500).send(e);
    }
  });

  app.patch('/projects/:id/team', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const projID = req.params.id;
      const userID = req.body.userID;
      const role = req.body.role;
      if (userID === undefined || role === undefined) {
        res.status(400).send(new Error('You must include a userID and a role in the request'));
      }

      const canUpdate = await agility.getMemberStatus(auth['sub'], projID);
      if (!canUpdate || canUpdate.role === 'Developer') {
        res.status(403).send(new Error('You are unauthorized to change users roles in this project'));
      }

      await agility.updateMemberStatus(userID, projID, role);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.send(500).send(e);
    }
  })

  // Sprint Routes
  app.get('/sprints', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const pID = req.header('projectid') || '';
      const canRead = await agility.getMemberStatus(auth['sub'], pID);
      if (!canRead) {
        res.status(403).send(new Error('You are unauthorized to see this project\'s sprints'));
      }

      const sprints = await agility.getSprints(pID);
      res.status(200).send(sprints);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.get('/sprints/:id', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const id = req.params.id;
      const pID = req.header('projectid') || '';
      const canRead = await agility.getMemberStatus(auth['sub'], pID);
      if (!canRead) {
        res.status(403).send(new Error('You are unauthorized to see this sprint'));
      }

      const sprint = await agility.getSprintByID(id);
      res.status(200).send(sprint);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.post('/sprints', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const params = {
        projID: req.body.projID,
        header: req.body.header,
        due: new Date(req.body.due),
        description: req.body.description
      };
      if (params.projID === undefined || params.header === undefined || params.due === undefined || params.description === undefined) {
        res.status(400).send(new Error('You must include a projectID, sprint header, due date, and description in the request'));
      }

      const canCreate = await agility.getMemberStatus(auth['sub'], params.projID);
      if (!canCreate || canCreate.role === 'Developer') {
        res.status(403).send(new Error('You are unauthorized to create a sprint for this project'));
      }

      const sID = await agility.createSprint(params);
      res.status(201).send(sID);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.patch('/sprints/:id', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const id = req.params.id;
      const params = {
        projID: req.body.projID,
        header: req.body.header,
        due: new Date(req.body.due),
        description: req.body.description
      };
      if (params.projID === undefined || params.header === undefined || params.due === undefined || params.description === undefined) {
        res.status(400).send(new Error('You must include a projectID, sprint header, due date, and description in the request'));
      }

      const canUpdate = await agility.getMemberStatus(auth['sub'], params.projID);
      if (!canUpdate || canUpdate.role === 'Developer') {
        res.status(403).send(new Error('You are unauthorized to update this sprint'));
      }

      await agility.updateSprint(id, params);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.delete('/sprints/:id', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const id = req.params.id;
      const sprint = await agility.getSprintByID(id);
      const canDelete = await agility.getMemberStatus(auth['sub'], sprint.projID);
      if (!canDelete || canDelete.role === 'Developer') {
        res.status(403).send(new Error('You are unauthorized to delete this sprint'));
      }

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
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const sID = req.header('sprintid') || '';
      const pID = req.header('projectid') || '';
      const canRead = await agility.getMemberStatus(auth['sub'], pID);
      if (!canRead) {
        res.status(403).send(new Error('You are unauthorized to see this sprint\'s tasks'));
      }

      const tasks = await agility.getSprintTasks(sID);
      res.status(200).send(tasks);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.get('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const id = req.params.id;
      const pID = req.header('projectid') || '';
      const canRead = await agility.getMemberStatus(auth['sub'], pID);
      if (!canRead) {
        res.status(403).send(new Error('You are unauthorized to see this task'));
      }

      const task = await agility.getSprintTask(id);
      res.status(200).send(task);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.post('/tasks', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const sID = req.body.sprintID;
      const params = {
        due: new Date(req.body.due),
        header: req.body.header,
        description: req.body.description
      };
      const pID = req.body.projectID;
      if (params.due === undefined || params.header === undefined || params.description === undefined || sID === undefined || pID === undefined) {
        res.status(400).send(
          new Error('You must include a projectID, sprintID, task due date, header, and description in the request'));
      }

      const canCreate = await agility.getMemberStatus(auth['sub'], pID);
      if (!canCreate) {
        res.status(403).send(new Error('You are unauthorized to create a task for this sprint'));
      }

      const id = await agility.createTask(sID, params);
      res.status(201).send(id);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.patch('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const id = req.params.id;
      const params = {
        sID: req.body.sprintID,
        due: new Date(req.body.due),
        header: req.body.header,
        description: req.body.description,
        block: req.body.block,
        note: req.body.note
      };
      if (params.sID === undefined || params.due === undefined || params.header === undefined || params.description === undefined || params.block === undefined || params.note === undefined) {
        res.status(400).send(
          new Error('You must include a sprintID, task due date, header, description, blocks, and notes in the request'));
      }

      const pID = req.header('projectid') || '';
      const canUpdate = await agility.getMemberStatus(auth['sub'], pID);
      if (!canUpdate) {
        res.status(403).send(new Error('You are unauthorized to update this task'));
      }
      await agility.updateTask(id, params);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.delete('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const id = req.params.id;
      const pID = req.header('projectid') || '';
      const canDelete = await agility.getMemberStatus(auth['sub'], pID);
      if (!canDelete) {
        res.status(403).send(new Error('You are unauthorized to delete this task'));
      }

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
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const tID = req.params.taskID;
      const notes = req.body.notes;
      if (notes === undefined) {
        res.status(400).send(new Error('You must include notes in the request'));
      }

      const pID = req.header('projectid') || '';
      const canCreate = await agility.getMemberStatus(auth['sub'], pID);
      if (!canCreate) {
        res.status(403).send(new Error('You are unauthorized to update notes for this task'));
      }

      await agility.updateNote(tID, notes);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  });

  app.post('/tasks/:taskID/blocks', async (req: Request, res: Response) => {
    try {
      const auth = await agility.validate(req.header('authorization'));
      if (!auth) {
        res.status(401).send(new Error('You must be signed in'));
      }

      const tID = req.params.taskID;
      const blocks = req.body.blocks;
      if (blocks === undefined) {
        res.status(400).send(new Error('You must include blocks in the request'));
      }

      const pID = req.header('projectid') || '';
      const canCreate = await agility.getMemberStatus(auth['sub'], pID);
      if (!canCreate) {
        res.status(403).send(new Error('You are unauthorized to update blocks for this task'));
      }

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