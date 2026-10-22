using UnityEngine;

namespace TheLastSnow.Core
{
    /// <summary>
    /// Tags temporary grey-box / procedural art so it can never be mistaken for final content.
    /// "The Last Snow/Placeholder Audit" lists every marker still in the project, with the
    /// final asset each one is waiting for.
    /// </summary>
    public class PlaceholderMarker : MonoBehaviour
    {
        [TextArea]
        public string finalAsset = "Replace with final art asset";
        public string category = "Environment";
    }
}
