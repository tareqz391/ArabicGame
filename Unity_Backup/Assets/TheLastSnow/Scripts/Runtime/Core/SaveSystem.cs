using System;
using System.IO;
using UnityEngine;

namespace TheLastSnow.Core
{
    [Serializable]
    public class SaveData
    {
        public int version = 1;
        public string checkpointId;
        public string[] flags = new string[0];
        public string savedAtUtc;
    }

    /// <summary>
    /// Local, offline auto-save. One JSON file in persistentDataPath, written atomically
    /// (temp file + replace) so a crash mid-write never corrupts the player's progress.
    /// </summary>
    public static class SaveSystem
    {
        const string FileName = "the_last_snow_save.json";

        public static string SavePath
        {
            get { return Path.Combine(Application.persistentDataPath, FileName); }
        }

        public static bool HasSave
        {
            get { return File.Exists(SavePath); }
        }

        public static event Action<string> Saved;

        public static void SaveCheckpoint(string checkpointId)
        {
            var data = new SaveData
            {
                checkpointId = checkpointId,
                flags = GameFlags.ToArray(),
                savedAtUtc = DateTime.UtcNow.ToString("o")
            };
            try
            {
                string tmp = SavePath + ".tmp";
                File.WriteAllText(tmp, JsonUtility.ToJson(data, true));
                if (File.Exists(SavePath)) File.Delete(SavePath);
                File.Move(tmp, SavePath);
                if (Saved != null) Saved(checkpointId);
            }
            catch (Exception e)
            {
                Debug.LogWarning("[SaveSystem] Could not write save: " + e.Message);
            }
        }

        public static SaveData Load()
        {
            if (!HasSave) return null;
            try
            {
                var data = JsonUtility.FromJson<SaveData>(File.ReadAllText(SavePath));
                return data;
            }
            catch (Exception e)
            {
                Debug.LogWarning("[SaveSystem] Save file unreadable, ignoring: " + e.Message);
                return null;
            }
        }

        public static void DeleteSave()
        {
            try
            {
                if (HasSave) File.Delete(SavePath);
            }
            catch (Exception e)
            {
                Debug.LogWarning("[SaveSystem] Could not delete save: " + e.Message);
            }
        }
    }
}
