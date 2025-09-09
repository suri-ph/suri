import sqlite3 from 'sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export interface FaceLog {
  id: string;
  timestamp: string;
  personId: string;
  confidence: number;
  mode: "auto" | "manual";
  processed_time: string;
}

export interface TodayStats {
  totalDetections: number;
  uniquePersons: number;
  firstDetection: string | null;
  lastDetection: string | null;
}

// Database row interfaces
interface FaceLogRow {
  id: string;
  timestamp: string;
  person_id: string;
  confidence: number;
  mode: "auto" | "manual";
  processed_time: string;
}

interface StatsRow {
  total_detections: number;
  unique_people: number;
  first_detection: string | null;
  last_detection: string | null;
}

interface CountRow {
  count: number;
}

interface PersonStatsRow {
  total_detections: number;
  avg_confidence: number;
  first_detection: string | null;
  last_detection: string | null;
  auto_detections: number;
  manual_detections: number;
}

interface PersonRow {
  person_id: string;
}

class Sqlite3FaceDatabase {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    // Store database in user data directory
    const userDataPath = app?.getPath?.('userData') || './data';
    
    // Ensure the directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    this.dbPath = path.join(userDataPath, 'face-logs.db');
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[INFO] Initializing SQLite3 database at: ${this.dbPath}`);
        
        // Create database connection with verbose mode for debugging
        const verbose = sqlite3.verbose();
        this.db = new verbose.Database(this.dbPath, (err) => {
          if (err) {
            console.error('❌ Failed to initialize SQLite3 database:', err);
            reject(err);
            return;
          }
          
          console.log(`[INFO] Connected to SQLite3 database at ${this.dbPath}`);
          
          // Create tables if they don't exist
          this.createTables()
            .then(() => {
              console.log('[SUCCESS] SQLite3 Face Database initialized successfully');
              resolve();
            })
            .catch(reject);
        });
      } catch (error) {
        console.error('❌ Failed to initialize SQLite3 database:', error);
        reject(error);
      }
    });
  }

  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Enable foreign keys and WAL mode for better performance
      this.db.serialize(() => {
        this.db!.run('PRAGMA foreign_keys = ON');
        this.db!.run('PRAGMA journal_mode = WAL');
        this.db!.run('PRAGMA synchronous = NORMAL');
        this.db!.run('PRAGMA cache_size = 10000');
        this.db!.run('PRAGMA temp_store = memory');

        // Face logs table - main logging data
        this.db!.run(`
          CREATE TABLE IF NOT EXISTS face_logs (
            id TEXT PRIMARY KEY,
            timestamp DATETIME NOT NULL,
            person_id TEXT NOT NULL,
            confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
            mode TEXT NOT NULL CHECK(mode IN ('auto', 'manual')),
            processed_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }

          // Create indexes for better performance
          this.db!.run('CREATE INDEX IF NOT EXISTS idx_face_logs_timestamp ON face_logs(timestamp DESC)', (err) => {
            if (err) reject(err);
          });
          
          this.db!.run('CREATE INDEX IF NOT EXISTS idx_face_logs_person_id ON face_logs(person_id)', (err) => {
            if (err) reject(err);
          });
          
          this.db!.run('CREATE INDEX IF NOT EXISTS idx_face_logs_mode ON face_logs(mode)', (err) => {
            if (err) reject(err);
          });
          
          this.db!.run('CREATE INDEX IF NOT EXISTS idx_face_logs_date ON face_logs(DATE(timestamp))', (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });
    });
  }

  async logDetection(personId: string, confidence: number, mode: "auto" | "manual"): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const now = new Date();
      const logId = `${Date.now()}_${personId.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const timestamp = now.toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO face_logs (id, timestamp, person_id, confidence, mode, processed_time)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run([logId, timestamp, personId, confidence, mode, timestamp], function(err) {
        if (err) {
          console.error('❌ SQLite3: Failed to log detection:', err);
          reject(err);
          return;
        }
        
        console.log(`✅ SQLite3: Logged detection for ${personId} (${mode}, ${(confidence * 100).toFixed(1)}%)`);
        resolve(logId);
      });

      stmt.finalize();
    });
  }

  async getRecentLogs(limit: number = 10): Promise<FaceLog[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT id, timestamp, person_id, confidence, mode, processed_time
        FROM face_logs 
        ORDER BY timestamp DESC 
        LIMIT ?
      `;

      this.db.all(sql, [limit], (err, rows: FaceLogRow[]) => {
        if (err) {
          console.error('❌ SQLite3: Failed to get recent logs:', err);
          reject(err);
          return;
        }

        const logs: FaceLog[] = rows.map((row: FaceLogRow) => ({
          id: row.id,
          timestamp: row.timestamp,
          personId: row.person_id,
          confidence: row.confidence,
          mode: row.mode,
          processed_time: row.processed_time
        }));

        resolve(logs);
      });
    });
  }

  async getTodayStats(): Promise<TodayStats> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      
      const sql = `
        SELECT 
          COUNT(*) as total_detections,
          COUNT(DISTINCT person_id) as unique_people,
          MIN(timestamp) as first_detection,
          MAX(timestamp) as last_detection
        FROM face_logs 
        WHERE DATE(timestamp) = ?
      `;

      this.db.get(sql, [today], (err, row: StatsRow | undefined) => {
        if (err) {
          console.error('❌ SQLite3: Failed to get today stats:', err);
          reject(err);
          return;
        }

        if (!row) {
          resolve({
            totalDetections: 0,
            uniquePersons: 0,
            firstDetection: null,
            lastDetection: null
          });
          return;
        }

        resolve({
          totalDetections: row.total_detections || 0,
          uniquePersons: row.unique_people || 0,
          firstDetection: row.first_detection || null,
          lastDetection: row.last_detection || null
        });
      });
    });
  }

  async exportData(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      try {
        // For SQLite3, we can simply copy the database file
        const backupPath = filePath.endsWith('.db') ? filePath : `${filePath}.db`;
        fs.copyFileSync(this.dbPath, backupPath);
        console.log(`📁 Database exported to: ${backupPath}`);
        resolve();
      } catch (error) {
        console.error('❌ Failed to export database:', error);
        reject(error);
      }
    });
  }

  async clearOldData(daysToKeep: number): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateStr = cutoffDate.toISOString();

      // First get count of records to be deleted
      const countSql = 'SELECT COUNT(*) as count FROM face_logs WHERE timestamp < ?';
      
      this.db.get(countSql, [cutoffDateStr], (err, row: CountRow | undefined) => {
        if (err) {
          console.error('❌ Failed to count old records:', err);
          reject(err);
          return;
        }

        const deleteCount = row?.count || 0;

        if (deleteCount > 0) {
          // Delete old records
          const deleteSql = 'DELETE FROM face_logs WHERE timestamp < ?';
          this.db!.run(deleteSql, [cutoffDateStr], function(err) {
            if (err) {
              console.error('❌ Failed to clear old data:', err);
              reject(err);
              return;
            }
            
            console.log(`🗑️ Deleted ${deleteCount} old records (older than ${daysToKeep} days)`);
            resolve(deleteCount);
          });
        } else {
          resolve(0);
        }
      });
    });
  }

  async healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.db) {
        resolve(false);
        return;
      }
      
      // Simple query to check if database is working
      this.db.get('SELECT 1', (err) => {
        resolve(!err);
      });
    });
  }

  async getAllPeople(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT DISTINCT person_id 
        FROM face_logs 
        WHERE person_id != 'unknown'
        ORDER BY person_id
      `;

      this.db.all(sql, [], (err, rows: PersonRow[]) => {
        if (err) {
          console.error('❌ SQLite3: Failed to get all people:', err);
          reject(err);
          return;
        }

        const people = rows.map(row => row.person_id);
        resolve(people);
      });
    });
  }

  async getPersonLogs(personId: string, limit: number = 50): Promise<FaceLog[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT id, timestamp, person_id, confidence, mode, processed_time
        FROM face_logs 
        WHERE person_id = ?
        ORDER BY timestamp DESC 
        LIMIT ?
      `;

      this.db.all(sql, [personId, limit], (err, rows: FaceLogRow[]) => {
        if (err) {
          console.error('❌ SQLite3: Failed to get person logs:', err);
          reject(err);
          return;
        }

        const logs: FaceLog[] = rows.map(row => ({
          id: row.id,
          timestamp: row.timestamp,
          personId: row.person_id,
          confidence: row.confidence,
          mode: row.mode,
          processed_time: row.processed_time
        }));

        resolve(logs);
      });
    });
  }

  async updatePersonId(oldPersonId: string, newPersonId: string): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Check if new person ID already exists
      const checkSql = 'SELECT COUNT(*) as count FROM face_logs WHERE person_id = ?';
      
      this.db.get(checkSql, [newPersonId], (err, row: CountRow | undefined) => {
        if (err) {
          reject(err);
          return;
        }

        if ((row?.count || 0) > 0) {
          reject(new Error(`Person ID "${newPersonId}" already exists`));
          return;
        }

        // Get count of records to be updated
        this.db!.get(checkSql, [oldPersonId], (err, countRow: CountRow | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          const updateCount = countRow?.count || 0;

          if (updateCount > 0) {
            // Update all records with the old person ID
            const updateSql = `
              UPDATE face_logs 
              SET person_id = ?, processed_time = CURRENT_TIMESTAMP 
              WHERE person_id = ?
            `;

            this.db!.run(updateSql, [newPersonId, oldPersonId], function(err) {
              if (err) {
                console.error('❌ Failed to update person ID:', err);
                reject(err);
                return;
              }
              
              console.log(`✏️ Updated ${updateCount} records: "${oldPersonId}" -> "${newPersonId}"`);
              resolve(updateCount);
            });
          } else {
            resolve(0);
          }
        });
      });
    });
  }

  async deletePersonRecords(personId: string): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Get count of records to be deleted
      const countSql = 'SELECT COUNT(*) as count FROM face_logs WHERE person_id = ?';
      
      this.db.get(countSql, [personId], (err, row: CountRow | undefined) => {
        if (err) {
          console.error('❌ Failed to count person records:', err);
          reject(err);
          return;
        }

        const deleteCount = row?.count || 0;

        if (deleteCount > 0) {
          // Delete all records for this person
          const deleteSql = 'DELETE FROM face_logs WHERE person_id = ?';
          this.db!.run(deleteSql, [personId], function(err) {
            if (err) {
              console.error('❌ Failed to delete person records:', err);
              reject(err);
              return;
            }
            
            console.log(`🗑️ Deleted ${deleteCount} records for person: ${personId}`);
            resolve(deleteCount);
          });
        } else {
          resolve(0);
        }
      });
    });
  }

  async getPersonStats(personId: string): Promise<{
    totalDetections: number;
    avgConfidence: number;
    firstDetection: string | null;
    lastDetection: string | null;
    autoDetections: number;
    manualDetections: number;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT 
          COUNT(*) as total_detections,
          AVG(confidence) as avg_confidence,
          MIN(timestamp) as first_detection,
          MAX(timestamp) as last_detection,
          SUM(CASE WHEN mode = 'auto' THEN 1 ELSE 0 END) as auto_detections,
          SUM(CASE WHEN mode = 'manual' THEN 1 ELSE 0 END) as manual_detections
        FROM face_logs 
        WHERE person_id = ?
      `;

      this.db.get(sql, [personId], (err, row: PersonStatsRow | undefined) => {
        if (err) {
          console.error('❌ SQLite3: Failed to get person stats:', err);
          reject(err);
          return;
        }

        if (!row || row.total_detections === 0) {
          resolve({
            totalDetections: 0,
            avgConfidence: 0,
            firstDetection: null,
            lastDetection: null,
            autoDetections: 0,
            manualDetections: 0
          });
          return;
        }

        resolve({
          totalDetections: row.total_detections,
          avgConfidence: row.avg_confidence || 0,
          firstDetection: row.first_detection,
          lastDetection: row.last_detection,
          autoDetections: row.auto_detections,
          manualDetections: row.manual_detections
        });
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('❌ Failed to close database:', err);
          } else {
            console.log('📊 SQLite3 database closed successfully');
          }
          this.db = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async vacuum(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run('VACUUM', (err) => {
        if (err) {
          console.error('❌ Failed to vacuum database:', err);
          reject(err);
          return;
        }
        
        console.log('🧹 Database vacuum completed successfully');
        resolve();
      });
    });
  }
}

// Export singleton instance
export const sqlite3FaceDB = new Sqlite3FaceDatabase();
