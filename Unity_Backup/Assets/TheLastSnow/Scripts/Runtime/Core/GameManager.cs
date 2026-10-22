using System;
using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
using TheLastSnow.Audio;
using TheLastSnow.CameraSystem;
using TheLastSnow.Player;
using TheLastSnow.Story;
using TheLastSnow.UI;

namespace TheLastSnow.Core
{
    public enum GameState { MainMenu, Playing, Paused, GameOver }

    /// <summary>
    /// Owns the high-level flow: main menu, new game, continue, checkpoint saves and
    /// respawn after being caught. Respawning reloads the scene and rebuilds the world
    /// from flags, which keeps every system stateless with respect to "retries".
    /// </summary>
    [DefaultExecutionOrder(-200)]
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        // Survives the scene reload used for Continue / respawn.
        static bool resumeRequested;

        public PlayerController player;
        public SideCameraRig cameraRig;
        public MainMenuUI mainMenu;
        [Tooltip("Played when the player presses New Game.")]
        public StorySequence introSequence;
        [Tooltip("Checkpoint used when no save exists.")]
        public Checkpoint startCheckpoint;
        [Tooltip("Camera shot behind the main menu.")]
        public Transform menuCameraShot;

        public GameState State { get; private set; }
        public bool IsResuming { get; private set; }
        public string LastCheckpointId { get; private set; }

        public event Action<GameState> StateChanged;

        void Awake()
        {
            Instance = this;
            GameSettings.Apply();
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
            Localization.Loc.SetLanguage(GameSettings.Language);

            if (resumeRequested)
            {
                resumeRequested = false;
                var data = SaveSystem.Load();
                if (data != null)
                {
                    GameFlags.Load(data.flags);
                    LastCheckpointId = data.checkpointId;
                    IsResuming = true;
                }
            }
            if (!IsResuming) GameFlags.ResetAll();
        }

        void Start()
        {
            if (IsResuming)
            {
                var cp = Checkpoint.Find(LastCheckpointId);
                if (cp != null && player != null) player.Teleport(cp.SpawnPoint.position, cp.SpawnPoint.rotation);
                if (cameraRig != null) cameraRig.SnapToTarget();
                if (mainMenu != null) mainMenu.Hide();
                SetState(GameState.Playing);
                if (ScreenFader.Instance != null)
                {
                    ScreenFader.Instance.Alpha = 1f;
                    StartCoroutine(ScreenFader.Instance.FadeTo(0f, 1.2f));
                }
            }
            else
            {
                if (player != null) player.SetControlLocked(true);
                if (cameraRig != null && menuCameraShot != null) cameraRig.SetShot(menuCameraShot, 0f);
                if (mainMenu != null) mainMenu.Show();
                SetState(GameState.MainMenu);
                if (AudioManager.Instance != null) AudioManager.Instance.PlayMusic("piano_theme", 2f);
            }
        }

        void SetState(GameState s)
        {
            State = s;
            Time.timeScale = s == GameState.Paused ? 0f : 1f;
            AudioListener.pause = s == GameState.Paused;
            if (StateChanged != null) StateChanged(s);
        }

        public void NewGame()
        {
            SaveSystem.DeleteSave();
            GameFlags.ResetAll();
            LastCheckpointId = null;
            if (mainMenu != null) mainMenu.Hide();
            if (cameraRig != null) cameraRig.ClearShot(0f);
            if (startCheckpoint != null && player != null)
                player.Teleport(startCheckpoint.SpawnPoint.position, startCheckpoint.SpawnPoint.rotation);
            if (cameraRig != null) cameraRig.SnapToTarget();
            SetState(GameState.Playing);
            if (AudioManager.Instance != null) AudioManager.Instance.StopMusic(1.5f);
            if (introSequence != null) introSequence.Play();
            else if (player != null) player.SetControlLocked(false);
        }

        public void ContinueGame()
        {
            if (!SaveSystem.HasSave) { NewGame(); return; }
            resumeRequested = true;
            StartCoroutine(ReloadRoutine(0.6f));
        }

        public void ReachCheckpoint(string id)
        {
            LastCheckpointId = id;
            SaveSystem.SaveCheckpoint(id);
            if (SubtitleUI.Instance != null) SubtitleUI.Instance.FlashSaveIcon();
        }

        /// <summary>Called by enemies / the cold system. Fades out and reloads the last checkpoint.</summary>
        public void PlayerCaught()
        {
            if (State == GameState.GameOver) return;
            SetState(GameState.GameOver);
            if (player != null) player.SetControlLocked(true);
            if (AudioManager.Instance != null) AudioManager.Instance.PlaySfx("hollow_scream", 1f);
            if (cameraRig != null) cameraRig.Shake(0.5f, 0.6f);
            resumeRequested = SaveSystem.HasSave;
            StartCoroutine(ReloadRoutine(1.4f));
        }

        public void ReturnToMenu()
        {
            resumeRequested = false;
            StartCoroutine(ReloadRoutine(0.8f));
        }

        public void TogglePause()
        {
            if (State == GameState.Playing) SetState(GameState.Paused);
            else if (State == GameState.Paused) SetState(GameState.Playing);
        }

        IEnumerator ReloadRoutine(float fade)
        {
            Time.timeScale = 1f;
            AudioListener.pause = false;
            if (ScreenFader.Instance != null) yield return ScreenFader.Instance.FadeTo(1f, fade);
            SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
        }

        void OnApplicationPause(bool paused)
        {
            // Android sends the app to background: never resume straight into a chase.
            if (paused && State == GameState.Playing) SetState(GameState.Paused);
        }
    }
}
