import dotenv from "dotenv";
dotenv.config();

export interface AppConfig {
  PORT: number;
  NODE_ENV: string;
  FRONTEND_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ML_SERVICE_URL: string;
  ML_INTERNAL_KEY: string;
}

export const env: AppConfig = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  SUPABASE_URL: (process.env.SUPABASE_URL || "https://lnrhliamfervhrbxzaxj.supabase.co").replace(/\/$/, ""),
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "sb_publishable_GMBnZypQwL7IGrs_JI0KWQ_SmjVBeY_",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  ML_SERVICE_URL: (process.env.ML_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, ""),
  ML_INTERNAL_KEY: process.env.ML_INTERNAL_KEY || "4yr1FDncao9YNu1npB1CfEqDRw2B2q1LZoxpg1jspuA",
};

