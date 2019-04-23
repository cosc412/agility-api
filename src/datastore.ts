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
   * Get's the projects a user is apart of
   * @param userID The user's ID
   */
  async getUsersProjects(userID: any) {
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

}