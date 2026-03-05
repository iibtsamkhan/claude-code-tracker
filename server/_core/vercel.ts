import "dotenv/config";
import { createVercelApp } from "./vercelApp";

const app = createVercelApp();

export default async function handler(req: any, res: any) {
  return app(req, res);
}
