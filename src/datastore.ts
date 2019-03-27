import { Collection, MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config();

const URL = process.env.MONGO_CONNECTION || '';

export class OrdersDatastore {
  orders: Collection;

  constructor(client: MongoClient) {
    this.orders = client.db().collection('orders');
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

  async readAllOrders() {
    return await this.orders.find({}).toArray();
  }

  async createOrder(name: string) {
    await this.orders.insertOne({ name });
  }

  async deleteOrder(id: string) {
    await this.orders.deleteOne({ _id: new ObjectId(id) });
  }
}