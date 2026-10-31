import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { API_URL } from './config';

const MAX_QUEUE = 3;

/**
 * Liest Sätze nacheinander vor (Azure-Stimme über den eigenen Server).
 * Spricht die Lehrkraft schneller, werden alte Sätze übersprungen.
 */
export class Speaker {
  private player: AudioPlayer | null = null;
  private queue: string[] = [];
  private busy = false;
  onError: (msg: string) => void = () => {};

  constructor(private token: string) {}

  async start() {
    // Auch im Lautlos-Modus des iPhones hörbar (wie ein Video).
    await setAudioModeAsync({ playsInSilentMode: true });
  }

  say(text: string) {
    if (!text.trim()) return;
    this.queue.push(text);
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
    if (!this.busy) this.next();
  }

  stop() {
    this.queue = [];
    this.player?.remove();
    this.player = null;
    this.busy = false;
  }

  private next() {
    const text = this.queue.shift();
    if (!text) {
      this.busy = false;
      return;
    }
    this.busy = true;
    const uri = `${API_URL}/api/app/tts?text=${encodeURIComponent(text)}`;
    this.player?.remove();
    const p = createAudioPlayer({ uri, headers: { Authorization: `Bearer ${this.token}` } });
    this.player = p;
    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        this.onError('Vorlesen hat nicht geantwortet.');
        this.next();
      }
    }, 12000);
    p.addListener('playbackStatusUpdate', (s) => {
      if (s.isLoaded && !started) {
        started = true;
        p.play();
      }
      if (s.didJustFinish) {
        clearTimeout(timeout);
        this.next();
      }
    });
  }
}
