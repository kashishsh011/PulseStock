// src/supabase.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gwcxmsypztepvgiyyhpo.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Y3htc3lwenRlcHZnaXl5aHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDkyOTUsImV4cCI6MjA5MTU4NTI5NX0.QZ85xwhGvZo9Jq73SuLx8kukH6LYAKupipWNYzeSyKk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)