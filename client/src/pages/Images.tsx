import { Link } from 'react-router-dom';
import { ImageLibrary } from '../components/ImageLibrary';

/** The player's image library on its own page: import, search, rename and delete (image-library). */
export function ImagesPage() {
  return (
    <div className="page">
      <header className="topbar">
        <Link to="/decks">
          <button aria-label="Back to decks">←</button>
        </Link>
        <h1>Images</h1>
      </header>
      <div className="content">
        <p className="small-text muted">Your images are private. Import artwork here, then choose it for card fronts, backs and deck backs, or create cards from it.</p>
        <ImageLibrary mode="manage" />
      </div>
    </div>
  );
}
