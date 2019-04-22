import { Collection, MongoClient, ObjectId, Db } from 'mongodb';
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

  async validateUser(token: string, params: {name: string, email: string, imageURL: string}) {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.CLIENT_ID
    });
    const payload = ticket.getPayload();
    const id = payload['sub'];
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

}