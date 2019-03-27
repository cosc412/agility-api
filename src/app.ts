import { MongoClient } from "mongodb";
import { OrdersDatastore } from "./datastore";
import * as express from 'express';
import * as morgan from 'morgan';
import { Request, Response } from 'express';

const bodyParser = require('body-parser');

OrdersDatastore
  .connect()
  .then((client: MongoClient) => {
    const ordersDatastore = new OrdersDatastore(client);
    startServer(ordersDatastore);
  });

function startServer(ordersDatastore: OrdersDatastore) {
  const app = express();

  app.use(morgan('dev'));

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  const port = process.env.PORT || 3000;

  app.get('/orders', async (request: Request, response: Response) => {
    const orders = await ordersDatastore.readAllOrders();
    response.json({ orders });
  });

  app.post('/orders', async (request, response) => {
    const name = request.body.name;
    try {
      await ordersDatastore.createOrder(name);
      response.sendStatus(201);
    } catch (error) {
      response.sendStatus(500);
    }
  });
    
  app.delete('/orders/:id', async (request, response) => {
    const id = request.params.id;
    try {
      await ordersDatastore.deleteOrder(id);
      response.sendStatus(204);
    } catch (error) {
      response.sendStatus(500);
    }
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}