"use strict";

import express from "express";
import { handler } from "./netlify/functions/api.js";

const app = express();
app.use(handler);
