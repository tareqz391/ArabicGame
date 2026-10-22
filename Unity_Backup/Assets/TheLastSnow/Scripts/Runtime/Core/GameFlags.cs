using System;
using System.Collections.Generic;

namespace TheLastSnow.Core
{
    /// <summary>
    /// Global story/puzzle state. Every persistent fact about the world ("battery inserted",
    /// "intro finished") is a string flag, so the save file stays a flat list and any
    /// component can react to progress without hard references.
    /// </summary>
    public static class GameFlags
    {
        static readonly HashSet<string> flags = new HashSet<string>();

        public static event Action<string> FlagSet;
        public static event Action<string> FlagCleared;

        public static bool Has(string flag)
        {
            return !string.IsNullOrEmpty(flag) && flags.Contains(flag);
        }

        public static void Set(string flag)
        {
            if (string.IsNullOrEmpty(flag)) return;
            if (flags.Add(flag) && FlagSet != null) FlagSet(flag);
        }

        public static void Clear(string flag)
        {
            if (string.IsNullOrEmpty(flag)) return;
            if (flags.Remove(flag) && FlagCleared != null) FlagCleared(flag);
        }

        public static void ResetAll()
        {
            flags.Clear();
        }

        public static void Load(IEnumerable<string> saved)
        {
            flags.Clear();
            if (saved == null) return;
            foreach (var f in saved)
                if (!string.IsNullOrEmpty(f)) flags.Add(f);
        }

        public static string[] ToArray()
        {
            var arr = new string[flags.Count];
            flags.CopyTo(arr);
            return arr;
        }
    }
}
