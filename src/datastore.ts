import { Collection, MongoClient, ObjectId, Db } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config();

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

}