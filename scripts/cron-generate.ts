import "dotenv/config";
import {
  closeMissedPeriods,
  generateOccurrences,
} from "../src/server/services/occurrence-generate";

const generated = generateOccurrences();
const closed = closeMissedPeriods();
console.log(JSON.stringify({ ok: true, generated, closed }, null, 2));
