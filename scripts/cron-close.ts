import "dotenv/config";
import { closeMissedPeriods } from "../src/server/services/occurrence-generate";

const closed = closeMissedPeriods();
console.log(JSON.stringify({ ok: true, closed }, null, 2));
