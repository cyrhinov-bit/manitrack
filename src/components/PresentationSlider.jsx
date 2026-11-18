import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import cassavaFarm from '../assets/cassava/cassava-farm.webp';
import cassavaGrowing from '../assets/cassava/cassava-growing.webp';
import cassavaHarvest from '../assets/cassava/cassava-harvest.webp';
import cassavaHistory from '../assets/cassava/cassava-history.webp';
import cassavaWorkers from '../assets/cassava/cassava-workers.webp';
import cultivateurManioc from '../assets/cassava/cultivateur-manioc.webp';
import farmerPlanting from '../assets/cassava/farmer-planting.webp';
import './PresentationSlider.css';

const fallbackImage = {
  src: cassavaFarm,
  alt: 'Parcelle de manioc en Afrique de l’Ouest',
  artist: 'Cpraise',
  source: 'https://commons.wikimedia.org/wiki/File:A_Massive_Cassava_Farm.jpg',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
};

const slides = [
  {
    title: 'Bienvenue sur ManiTrack !',
    description: 'La plateforme numérique dédiée au recensement, à la géolocalisation et au suivi des producteurs et des exploitations de manioc en Côte d’Ivoire.',
    detail: 'Enregistrez vos champs, suivez vos plantations et déclarez vos récoltes depuis votre téléphone.',
    image: cultivateurManioc,
    alt: 'Producteur inspectant ses plants de manioc en Côte d’Ivoire',
    artist: 'Metchyves',
    source: 'https://commons.wikimedia.org/wiki/File:Cultivateur_de_manioc.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    title: 'Créez votre compte producteur',
    description: 'Inscrivez-vous sur ManiTrack en renseignant vos informations personnelles, votre numéro de téléphone et votre localité.',
    detail: 'Vous disposerez d’un espace personnel pour gérer vos activités agricoles.',
    image: cassavaWorkers,
    alt: 'Productrice et ouvriers autour de racines de manioc récoltées en Ouganda',
    artist: 'Emmanuel Ssekaggo',
    source: 'https://commons.wikimedia.org/wiki/File:A_farmer_with_her_workers_harvesting_cassava.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    title: 'Enregistrez vos champs de manioc',
    description: 'Ajoutez vos parcelles en indiquant leur localisation, leur superficie et leur position GPS.',
    detail: 'Vous pourrez également ajouter des photos de vos exploitations.',
    image: cassavaFarm,
    alt: 'Grande parcelle de manioc en Afrique de l’Ouest',
    artist: 'Cpraise',
    source: 'https://commons.wikimedia.org/wiki/File:A_Massive_Cassava_Farm.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    title: 'Renseignez vos plantations',
    description: 'Pour chaque parcelle, renseignez la variété de manioc cultivée, la date de plantation, la superficie mise en culture et la période prévisionnelle de récolte.',
    image: farmerPlanting,
    alt: 'Producteur en train de planter du manioc dans son champ',
    artist: 'Iwai-Dialax',
    source: 'https://commons.wikimedia.org/wiki/File:Farmer_planting_cassava.jpg',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    title: 'Suivez l’évolution de vos champs',
    description: 'Publiez des informations et des photos sur vos plantations tout au long du cycle de culture : croissance, désherbage, entretien, difficultés rencontrées et maturité.',
    image: cassavaGrowing,
    alt: 'Plants de manioc en croissance dans une parcelle au Sénégal',
    artist: 'Wuzyprod',
    source: 'https://commons.wikimedia.org/wiki/File:Gnambi_(Cassava)_from_Diamniadio,_Senegal_02.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    title: 'Déclarez vos récoltes',
    description: 'Lorsque votre manioc arrive à maturité, renseignez la date de récolte, la superficie récoltée et la quantité obtenue en tonnes.',
    detail: 'Vous pourrez également joindre des photos de votre récolte.',
    image: cassavaHarvest,
    alt: 'Producteur présentant des racines de manioc fraîchement récoltées',
    artist: 'OnyekeEjike',
    source: 'https://commons.wikimedia.org/wiki/File:A_Farmer_Harvesting_Cassava_Root.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    title: 'Gardez une trace de vos activités agricoles',
    description: 'Retrouvez vos parcelles, vos cycles de culture, vos publications et vos récoltes dans votre espace personnel.',
    detail: 'ManiTrack vous permet de conserver un historique numérique de votre exploitation.',
    image: cassavaHistory,
    alt: 'Parcelle de manioc cultivée au Sénégal',
    artist: 'Wuzyprod',
    source: 'https://commons.wikimedia.org/wiki/File:Gnambi_(Cassava)_from_Diamniadio,_Senegal_03.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
];

function PresentationSlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fallbackIndex, setFallbackIndex] = useState(null);
  const [unavailableIndex, setUnavailableIndex] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const activeSlide = slides[activeIndex];
  const usesFallback = fallbackIndex === activeIndex || activeSlide.image === fallbackImage.src;
  const imageSource = fallbackIndex === activeIndex ? fallbackImage.src : activeSlide.image;
  const imageUnavailable = unavailableIndex === activeIndex;
  const photoCredit = imageUnavailable ? null : usesFallback ? fallbackImage : activeSlide;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(preference.matches);

    updatePreference();
    preference.addEventListener('change', updatePreference);

    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion || hasInteracted) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [hasInteracted, reducedMotion]);

  const showSlide = (index) => {
    setHasInteracted(true);
    setActiveIndex((index + slides.length) % slides.length);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showSlide(activeIndex - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showSlide(activeIndex + 1);
    }
  };

  const handleImageError = () => {
    if (!usesFallback) {
      setFallbackIndex(activeIndex);
      return;
    }

    setUnavailableIndex(activeIndex);
  };

  return (
    <section
      className="presentation-slider"
      aria-label="Présentation de ManiTrack"
      aria-roledescription="carrousel"
      onFocusCapture={() => setHasInteracted(true)}
      onPointerDown={() => setHasInteracted(true)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="presentation-slider__card">
        <figure className="presentation-slider__visual">
          {imageUnavailable ? (
            <div className="presentation-slider__image-fallback" role="img" aria-label="Image indisponible">
              <span>Visuel ManiTrack indisponible</span>
            </div>
          ) : (
            <img
              key={`${activeIndex}-${imageSource}`}
              className="presentation-slider__image"
              src={imageSource}
              alt={usesFallback ? fallbackImage.alt : activeSlide.alt}
              loading="eager"
              onError={handleImageError}
            />
          )}
          {photoCredit && (
            <figcaption className="presentation-slider__credit">
              Photo : <a href={photoCredit.source} target="_blank" rel="noreferrer">{photoCredit.artist}</a>
              {' · '}
              <a href={photoCredit.licenseUrl} target="_blank" rel="noreferrer">{photoCredit.license}</a>
            </figcaption>
          )}
        </figure>

        <div className="presentation-slider__content" aria-live={hasInteracted ? 'polite' : 'off'}>
          <p className="presentation-slider__eyebrow">Découvrir ManiTrack</p>
          <p className="presentation-slider__count">
            <span>{String(activeIndex + 1).padStart(2, '0')}</span>
            <span aria-hidden="true"> / </span>
            <span className="presentation-slider__count-total">{String(slides.length).padStart(2, '0')}</span>
          </p>
          <div className="presentation-slider__copy" key={activeIndex}>
            <h2>{activeSlide.title}</h2>
            <p>{activeSlide.description}</p>
            {activeSlide.detail && <p>{activeSlide.detail}</p>}
          </div>

          <div className="presentation-slider__progress" aria-hidden="true">
            <span style={{ width: `${((activeIndex + 1) / slides.length) * 100}%` }} />
          </div>

          <div className="presentation-slider__controls">
            <div className="presentation-slider__pagination" aria-label="Choisir une diapositive">
              {slides.map((slide, index) => (
                <button
                  key={slide.title}
                  className={`presentation-slider__dot${index === activeIndex ? ' is-active' : ''}`}
                  type="button"
                  aria-label={`Afficher la diapositive ${index + 1} : ${slide.title}`}
                  aria-current={index === activeIndex ? 'true' : undefined}
                  onClick={() => showSlide(index)}
                />
              ))}
            </div>
            <div className="presentation-slider__arrows">
              <button
                type="button"
                aria-label="Diapositive précédente"
                onClick={() => showSlide(activeIndex - 1)}
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Diapositive suivante"
                onClick={() => showSlide(activeIndex + 1)}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default PresentationSlider;
