import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "proyek_coursenet",
  waitForConnections: true,
  connectionLimit: 10,
});
