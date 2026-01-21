import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import { connectMongo, disconnectMongo } from "./db";

const app = express();

// Basic middlewares
app.use(express.json());

async function start() {
  await connectMongo();

  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => {
    console.log(`Service is listening on port ${port}`);
  });
}

start();