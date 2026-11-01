import { useState, useEffect } from 'react';

const TARGET = 60000000;

export function useScore() {
  const [score, setScoreState] = useState(0);
  const [target, setTargetState] = useState(TARGET);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let fallbackToLocal = false;

    const fetchScore = async () => {
      try {
        const response = await fetch('./api.php');
        if (!response.ok) {
          throw new Error('API not available');
        }
        
        // Ensure it's json (e.g. not an HTML page from Vite dev server)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
           throw new Error("Not JSON");
        }

        const data = await response.json();
        if (isMounted) {
          setScoreState(data.score ?? 0);
          setTargetState(data.target ?? TARGET);
          setLoading(false);
        }
      } catch (err) {
        // Fallback for AI Studio preview (where api.php doesn't run)
        if (isMounted) {
          fallbackToLocal = true;
          const localScore = localStorage.getItem('kiyan_score');
          setScoreState(localScore ? parseInt(localScore, 10) : 0);
          setLoading(false);
        }
      }
    };

    fetchScore();

    // Poll every 5 seconds for live updates from PHP
    const interval = setInterval(() => {
      if (!fallbackToLocal) {
        fetchScore();
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const setScore = async (newScore: number) => {
    // Optimistic update
    setScoreState(newScore);

    try {
      const response = await fetch('./api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: newScore })
      });
      
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error('API not available');
      }
    } catch (err) {
      // Fallback for AI Studio preview
      localStorage.setItem('kiyan_score', newScore.toString());
    }
  };

  return { score, setScore, target, loading };
}
