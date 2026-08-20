import dotenv from "dotenv";

dotenv.config();

jest.setTimeout(20000);

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
});