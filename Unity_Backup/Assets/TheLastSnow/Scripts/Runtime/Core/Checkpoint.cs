using System.Collections.Generic;
using UnityEngine;
using TheLastSnow.Player;

namespace TheLastSnow.Core
{
    /// <summary>
    /// Auto-save point. Saves when the player walks into its trigger (or when a story
    /// sequence asks for it) and is used as the respawn transform after loading.
    /// Place one before every chase and important puzzle.
    /// </summary>
    [RequireComponent(typeof(Collider))]
    public class Checkpoint : MonoBehaviour
    {
        static readonly Dictionary<string, Checkpoint> registry = new Dictionary<string, Checkpoint>();

        public string id = "checkpoint";
        [Tooltip("Where the player stands after respawning. Defaults to this transform.")]
        public Transform spawnPoint;
        [Tooltip("Optional: only activates once this flag is set.")]
        public string requiredFlag;
        public bool saveOnEnter = true;

        public static Checkpoint Find(string id)
        {
            Checkpoint cp;
            return id != null && registry.TryGetValue(id, out cp) ? cp : null;
        }

        public Transform SpawnPoint
        {
            get { return spawnPoint != null ? spawnPoint : transform; }
        }

        void Awake()
        {
            registry[id] = this;
            GetComponent<Collider>().isTrigger = true;
        }

        void OnDestroy()
        {
            Checkpoint cp;
            if (registry.TryGetValue(id, out cp) && cp == this) registry.Remove(id);
        }

        void OnTriggerEnter(Collider other)
        {
            if (!saveOnEnter) return;
            if (!string.IsNullOrEmpty(requiredFlag) && !GameFlags.Has(requiredFlag)) return;
            if (other.GetComponent<PlayerController>() == null) return;
            if (GameManager.Instance != null && GameManager.Instance.LastCheckpointId == id) return;
            if (GameManager.Instance != null) GameManager.Instance.ReachCheckpoint(id);
        }

        void OnDrawGizmos()
        {
            Gizmos.color = new Color(0.3f, 1f, 0.5f, 0.6f);
            Gizmos.DrawWireCube(SpawnPoint.position + Vector3.up, new Vector3(0.6f, 2f, 0.6f));
        }
    }
}
