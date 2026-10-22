using System.Collections;
using UnityEngine;

namespace TheLastSnow.Core
{
    /// <summary>Full-screen black fade used by cutscenes, respawns and scene transitions.</summary>
    public class ScreenFader : MonoBehaviour
    {
        public static ScreenFader Instance { get; private set; }

        public CanvasGroup group;

        void Awake()
        {
            Instance = this;
            if (group == null) group = GetComponent<CanvasGroup>();
        }

        public float Alpha
        {
            get { return group != null ? group.alpha : 0f; }
            set
            {
                if (group == null) return;
                group.alpha = value;
                group.blocksRaycasts = value > 0.01f;
            }
        }

        public IEnumerator FadeTo(float target, float duration)
        {
            float start = Alpha;
            if (duration <= 0f) { Alpha = target; yield break; }
            for (float t = 0f; t < duration; t += Time.unscaledDeltaTime)
            {
                Alpha = Mathf.Lerp(start, target, Mathf.SmoothStep(0f, 1f, t / duration));
                yield return null;
            }
            Alpha = target;
        }
    }
}
