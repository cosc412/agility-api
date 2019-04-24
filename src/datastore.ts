import { MongoClient, ObjectId, Db } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config();
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.CLIENT_ID);

const URL = process.env.MONGO_CONNECTION || '';

export class AgilityDatastore {
  db: Db;

  constructor(client: MongoClient) {
    this.db = client.db('AgilityDB');
  }
  
  static async connect() {
    return new Promise<MongoClient>((resolve, reject) =>
      MongoClient.connect(URL, async (err: Error, client: MongoClient) => {
        if (err) {
          reject(err);
        }
        resolve(client);
      }));
  }

  /**
   * Validates if the user exists in the system. If they do then update the user metadata if nessesary
   * and return the user, else create a new user with this metadata
   * @param token Google user token generated by the client
   * @param params User params [name, email, and profile URL]
   */
  async validateUser(token: string) {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.CLIENT_ID
    });
    const payload = ticket.getPayload();
    const id = payload['sub'];
    const user = await this.findUser(id);
    
    const data = { name: payload['name'], email: payload['email'], profileURL: payload['picture'] };
    // If the user doesn't exist, create a new user
    if (user == undefined) {
      await this.createUser(id, data);
    } else {
      // Check if metadata needs to be updated
      if (user.name !== payload['name'] || user.email !== payload['email'] || user.profileURL !== payload['picture']) {
        await this.updateUser(id, data);
      }
    }
    return await this.findUser(id);
  }

  /**
   * Creates a new user in the database
   * @param id ID generated via the google API
   * @param params User params [name, email, and profile URL]
   */
  async createUser(id: string, params: {name: string, email: string, profileURL: string}) {
    await this.db.collection('users').insertOne({
      _id: id,
      name: params.name,
      email: params.email,
      profileURL: params.profileURL
    });
  }

  /**
   * Returns user in database
   * @param id User ID generated by the google API
   */
  async findUser(id: string) {
    return await this.db.collection('users').findOne({ _id: id });
  }

  /**
   * Updates the user in the database
   * @param id User ID
   * @param params User data to update
   */
  async updateUser(id: string, params: {name: string, email: string, profileURL: string}) {
    await this.db.collection('users').findOneAndUpdate({ _id: id }, {
      $set: {
        name: params.name,
        email: params.email,
        profileURL: params.profileURL
      }
    });
  }

  /**
   * Returns the role of the user for a given project
   * @param userID User ID
   * @param projID Project ID
   */
  async getMemberStatus(userID: string, projID: string) {
    return await this.db.collection('team').findOne({ userID: userID, projectID: new ObjectId(projID) });
  }

  /**
   * Gets the projects and role for a given user
   * @param userID User ID
   */
  async getAllMemberStatus(userID: string) {
    return await this.db.collection('team').find({ userID: userID }).toArray();
  }

  /**
   * Get's the projects a user is apart of
   * @param userID The user's ID
   */
  async getUsersProjects(userID: string) {
    const projectIDs = await this.db.collection('team').find({ userID: userID }).toArray();
    let pIDs: string[] = [];
    projectIDs.forEach(item => {
      pIDs.push(item.projectID);
    });
    return await this.getProjectsByIDs(pIDs);
  }

  /**
   * Returns a array of projects given a list of project IDs
   * @param pIDs Array of project IDs
   */
  async getProjectsByIDs(pIDs: string[]) {
    const ids: ObjectId[] = [];
    pIDs.forEach(id => {
      ids.push(new ObjectId(id));
    });
    return await this.db.collection('projects').find({ _id: { $in: ids } }).toArray();
  }

  /**
   * Returns a project given it's ID
   * @param pID The project ID
   */
  async getProjectByID(pID: string) {
    return await this.db.collection('projects').findOne({ _id: new ObjectId(pID) });
  }
  
  /**
   * Creates a project with params given, initializes person as project lead
   * @param params Project params [name, description, userID]
   */
  async createProject(params: { name: string, description: string, userID: string }) {
    const id = new ObjectId();
    await this.db.collection('projects').insertOne({ _id: id,  name: params.name, description: params.description });
    await this.db.collection('team').insertOne({ projectID: id, userID: params.userID, role: 'Project Lead' });
    return await this.getProjectByID(id.toHexString());
  }

  /**
   * Deletes a project and corrosponding team members from the database
   * @param pID Project ID to delete
   */
  async deleteProject(pID: string) {
    await this.db.collection('team').deleteMany({ projectID: new ObjectId(pID) });
    await this.db.collection('projects').deleteOne({ _id: new ObjectId(pID) });
  }

  /**
   * Updates the project metadata given a project id and metadata
   * @param pID Project ID to update
   * @param params Data to update
   */
  async updateProject(pID: string, params: { name: string, description: string }) {
    await this.db.collection('projects').updateOne({ _id: new ObjectId(pID) }, {
      $set: {
        name: params.name,
        description: params.description
      }
    });
  }

  /**
   * Returns the sprints associated with a project given a project ID
   * @param pID Project ID
   */
  async getSprints(pID: string) {
    return await this.db.collection('sprints').find({ projID: pID }).toArray();
  }

  /**
   * Returns the sprint given its ID
   * @param sID Sprint ID
   */
  async getSprintByID(sID: string) {
    return await this.db.collection('sprints').findOne({ _id: new ObjectId(sID) });
  }

  /**
   * Creates a new sprint given the data needed to create a new sprint
   * @param params Data needed to create a new sprint
   */
  async createSprint(params: { projID: string, header: string, due: Date, description: string }) {
    const id = new ObjectId();
    await this.db.collection('sprints').insertOne({
      _id: id,
      projID: params.projID,
      header: params.header,
      due: params.due,
      description: params.description
    });
    return id.toHexString();
  }

  /**
   * Update an existing sprint with given data
   * @param sID Sprint ID
   * @param params Data needed to update a sprint
   */
  async updateSprint(sID: string, params: { projID: string, header: string, due: Date, description: string }) {
    await this.db.collection('sprints').updateOne({ _id: new ObjectId(sID) }, {
      $set: {
        projID: params.projID,
        header: params.header,
        due: params.due,
        description: params.description
      }
    });
  }

  /**
   * Deletes a sprint given its ID
   * @param sID Sprint ID
   */
  async deleteSprint(sID: string) {
    await this.db.collection('sprints').deleteOne({ _id: new ObjectId(sID) });
  }

  /**
   * Returns the related tasks for a given sprint
   * @param sID Sprint ID
   */
  async getSprintTasks(sID: string) {
    return await this.db.collection('tasks').find({ sprintID: sID }).toArray();
  }

  /**
   * Returns the task for a given task ID
   * @param tID Task ID
   */
  async getSprintTask(tID: string) {
    return await this.db.collection('tasks').findOne({ _id: new ObjectId(tID) });
  }

  /**
   * Creates a new task given input
   * @param sID Sprint ID
   * @param params Data needed to make a task
   */
  async createTask(sID: string, params: {due: Date, header: string, description: string}) {
    const id = new ObjectId();
    await this.db.collection('tasks').insertOne({
      _id: id,
      sprintID: sID,
      due: params.due,
      header: params.header,
      description: params.description,
      block: [],
      note: []
    });
    return id;
  }

  /**
   * Updates a task given input
   * @param tID Task ID
   * @param params Data needed to update a task
   */
  async updateTask(tID: string, params:
    {
      sID: string,
      due: Date,
      header: string,
      description: string,
      block: string[],
      note: string[]
    }) {
        await this.db.collection('tasks').updateOne({ _id: new ObjectId(tID) }, {
          $set: {
            sprintID: params.sID,
            due: params.due,
            header: params.header,
            description: params.description,
            block: params.block,
            note: params.note
          }
        });
  }

  /**
   * Delete task given its ID
   * @param tID Task ID
   */
  async deleteTask(tID: string) {
    await this.db.collection('tasks').deleteOne({ _id: new ObjectId(tID) });
  }

  /**
   * Updates the notes for a given task [add, updated, and delete]
   * @param tID Task ID
   * @param notes Notes to add/update/delete
   */
  async updateNote(tID: string, notes: string[]) {
    await this.db.collection('tasks').updateOne({ _id: new ObjectId(tID) }, {
      $set: {
        note: notes
      }
    });
  }

  /**
   * Updates the blocks for a given task [add, update, and delete]
   * @param tID Task ID
   * @param blocks Blocks to add/update/delete
   */
  async updateBlock(tID: string, blocks: string[]) {
    await this.db.collection('tasks').updateOne({ _id: new ObjectId(tID) }, {
      $set: {
        block: blocks
      }
    });
  }

}