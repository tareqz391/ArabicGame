using UnityEngine;

namespace TheLastSnow.Core
{
    /// <summary>Per-device preferences (not story progress): frame-rate target, language.</summary>
    public static class GameSettings
    {
        const string Fps60Key = "tls.fps60";
        const string LanguageKey = "tls.language";

        public static bool HighFrameRate
        {
            get { return PlayerPrefs.GetInt(Fps60Key, 0) == 1; }
            set
            {
                PlayerPrefs.SetInt(Fps60Key, value ? 1 : 0);
                PlayerPrefs.Save();
                Apply();
            }
        }

        /// <summary>"ar" or "en". Defaults to Arabic when the device language is Arabic.</summary>
        public static string Language
        {
            get
            {
                string fallback = Application.systemLanguage == SystemLanguage.Arabic ? "ar" : "en";
                return PlayerPrefs.GetString(LanguageKey, fallback);
            }
            set
            {
                PlayerPrefs.SetString(LanguageKey, value);
                PlayerPrefs.Save();
            }
        }

        public static void Apply()
        {
            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = HighFrameRate ? 60 : 30;
        }
    }
}
