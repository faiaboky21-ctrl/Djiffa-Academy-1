/**
 * DJIFFA ACADEMY - Courses & Curriculum Data
 * Directrice et Créatrice : Faith Ariola (DJIFFA DESIGN AGENCY)
 */

import { Course, DomainCategory, PromoCode, SiteSettings, CoachingProgramConfig } from '../types';
import { BRAND_IMAGES } from '../lib/assets';

export const INITIAL_COURSES: Course[] = [
  {
    id: 'course-faith-ariola-methode',
    slug: 'methode-faith-ariola-video-publicitaire-ia',
    title: 'La Méthode Faith Ariola : De l’idée à la création d’une vidéo publicitaire avec l’IA',
    subtitle: 'Le programme de référence pour concevoir des spots publicitaires et des campagnes de marque cinématiques générés par IA.',
    description: 'Une méthode pas-à-pas exclusive développée par Faith Ariola au sein de DJIFFA DESIGN AGENCY. Maîtrisez le pipeline créatif complet : conception stratégique, écriture du script, direction artistique, génération d’images cohérentes, animation de plans, voix off émotionnelles et montage professionnel.',
    domain: 'video_ads_ai',
    level: 'Tous niveaux',
    duration: '24 heures de formation · 5 modules intensifs',
    modulesCount: 5,
    lessonsCount: 16,
    priceXOF: 125000,
    originalPriceXOF: 175000,
    priceEUR: 190,
    priceUSD: 205,
    coverImage: BRAND_IMAGES.courseMethod,
    isFeatured: true,
    isPublished: true,
    certificateEligible: true,
    objectives: [
      'Transformer une simple intention commerciale en un concept de campagne percutant.',
      'Rédiger des storyboards et découpages techniques prêts pour la génération IA.',
      'Maîtriser les prompts d’éclairage, de cadrage, de texture et de continuité de personnages.',
      'Animer les visuels avec fluidité et cohérence de caméra (mouvements panoramiques, travellings).',
      'Créer des voix off professionnelles et concevoir une ambiance sonore de niveau agence.',
      'Assembler, étalonner et livrer un spot final de haute valeur marchande pour les marques.'
    ],
    skillsAcquired: [
      'Direction de campagne publicitaire IA',
      'Ingénierie de prompts cinématiques',
      'Continuité faciale et stylistique de personnages',
      'Motion generation & contrôle caméra (Runway, Kling, Luma)',
      'Sound design et voix off de synthèse (ElevenLabs)',
      'Montage rythmique & colorimétrie publicitaire'
    ],
    resourcesIncluded: [
      'Grimoire de 120+ Master Prompts publicitaires testés en agence',
      'Matrice de découpage de scénario publicitaire (Fichier Notion/PDF)',
      'Banque de textures audio, bruits d’ambiance et nappes sonores libres de droits',
      'Pack de fiches techniques de mouvements de caméras pour Runway & Kling',
      'Modèle de contrat et devis de prestation vidéo publicitaire DJIFFA DESIGN AGENCY'
    ],
    modules: [
      {
        id: 'mod-1',
        order: 1,
        title: 'Module 1 : Concept Stratégique & Scénarisation Publicitaire',
        description: 'Comment penser comme une directrice de création : positionnement, univers de marque et écriture du script.',
        lessons: [
          {
            id: 'les-1-1',
            moduleId: 'mod-1',
            title: '1.1 Transformer une idée brute en concept publicitaire à fort impact',
            duration: '22 min',
            type: 'video',
            summary: 'Découvrez la grille d’analyse DJIFFA pour identifier l’émotion centrale, le problème de l’audience et la promesse visuelle de la marque.',
            contentHtml: `
              <p>Dans cette première leçon fondamentale, Faith Ariola vous dévoile comment décomposer le brief d'un client pour extraire la pépite créative. L'erreur numéro 1 consiste à sauter immédiatement sur les outils de génération d'images. Une publicité qui vend commence par un angle émotionnel net.</p>
              <h4>Les 3 piliers d'un concept réussi :</h4>
              <ul>
                <li><strong>L'Accroche Visuelle (Hook) :</strong> Les 3 premières secondes qui arrêtent le scroll.</li>
                <li><strong>La Tension Dramatique :</strong> Le contraste entre le monde avant et après le produit.</li>
                <li><strong>Le Climax de Marque :</strong> L'apparition glorieuse du produit et l'appel à l'action.</li>
              </ul>
            `,
            keyTakeaways: [
              'Ne jamais générer sans brief écrit clair.',
              'Définir le style publicitaire en amont (luxe, dynamisme urbain, poésie organique).',
              'Construire le moodboard sémantique avant le moodboard visuel.'
            ],
            downloads: [
              { name: 'Matrice_Brief_Creatif_DJIFFA.pdf', type: 'PDF', size: '1.4 Mo', description: 'Le template de brief utilisé avec nos clients d’agence.' }
            ],
            exercise: {
              title: 'Exercice Pratique : Rédigez votre premier concept publicitaire',
              instructions: 'Choisissez une marque de cosmétique africaine de luxe ou une marque de boisson énergisante. Rédigez le concept en 150 mots en respectant la structure Hook / Tension / Résolution.',
              deliverable: 'Votre texte de concept et 3 adjectifs de direction artistique.',
              criteria: ['Clarté du positionnement', 'Impact des 3 premières secondes', 'Cohérence du ton'],
              modelCorrection: 'Exemple validé par Faith Ariola : Pour une marque de baume au karité béninois : Hook : Gros plan macro sur un désert craquelé qui se transforme sous une goutte dorée en peau satinée lumineuse. Tension : Les agressions du vent et du soleil urbain. Résolution : L’éclat impérial restauré, logo doré en surimpression.'
            }
          },
          {
            id: 'les-1-2',
            moduleId: 'mod-1',
            title: '1.2 Le découpage technique scène par scène pour l’IA',
            duration: '28 min',
            type: 'video',
            summary: 'Apprenez à rédiger un script calibré pour les moteurs de génération vidéo : durée des plans, mouvements de caméra et transitions prévues.',
            contentHtml: `
              <p>L'intelligence artificielle requiert une précision chirurgicale lors du découpage. Chaque plan de 4 à 5 secondes doit comporter une action unique et un cadrage sans ambiguïté.</p>
              <p>Nous abordons la règle des 6 plans pour un spot percutant de 30 secondes : Plan d'établissement, Plan moyen sujet, Gros plan détail produit, Plan d'action/mouvement, Plan émotionnel et Packshot final.</p>
            `,
            keyTakeaways: [
              'Un spot de 30 secondes se compose idéalement de 6 à 8 plans maximum.',
              'Chaque plan doit avoir son intention de caméra (zoom in, pan left, dolly forward).',
              'Laisser respirer le produit au moins 3 secondes en fin de vidéo.'
            ]
          }
        ]
      },
      {
        id: 'mod-2',
        order: 2,
        title: 'Module 2 : Direction Artistique & Continuité Visuelle',
        description: 'La création des personnages récurrents, le choix de la lumière et la formulation des prompts d’élite.',
        lessons: [
          {
            id: 'les-2-1',
            moduleId: 'mod-2',
            title: '2.1 Définir l’identité visuelle et la fiche personnage récurrente',
            duration: '35 min',
            type: 'video',
            summary: 'Technique avancée pour créer un personnage IA et le conserver identique d’une scène à l’autre sans distorsion.',
            contentHtml: `
              <p>Le plus grand défi de la vidéo publicitaire par IA est la cohérence. Si le visage du mannequin ou la forme du produit change d’un plan à l’autre, la crédibilité s’effondre instantanément.</p>
              <p>Faith Ariola vous enseigne la méthode des <em>ancres d'identité</em> : traits distinctifs, palette de couleurs de peau, coiffure volumétrique et descripteurs faciaux stables.</p>
            `,
            keyTakeaways: [
              'Créer une planche contact du personnage sous 4 angles différents avant de générer la vidéo.',
              'Utiliser des images de référence (Face ID, character reference tokens).',
              'Conserver les mêmes termes d’éclairage dans tous vos prompts dérivés.'
            ],
            downloads: [
              { name: 'Guide_Continuite_Personnages_IA.pdf', type: 'PDF', size: '2.8 Mo', description: 'La méthode pas-à-pas pour ancrer un visage dans Midjourney & Flux.' }
            ],
            quiz: [
              {
                id: 'q-2-1',
                question: 'Pourquoi est-il primordial de créer une planche de référence avant d’animer un personnage ?',
                options: [
                  'Pour s’assurer que les générateurs vidéo disposent d’une base d’identité cohérente pour chaque angle.',
                  'Pour réduire le coût de la connexion internet.',
                  'Parce que les clients ne veulent pas de vidéo animée.',
                  'Pour éviter d’avoir à écrire un scénario.'
                ],
                correctIndex: 0,
                explanation: 'Avoir des images sources propres sous plusieurs angles garantit que le modèle d’animation conserve les traits du visage et le costume sans dérive bizarre.'
              }
            ]
          },
          {
            id: 'les-2-2',
            moduleId: 'mod-2',
            title: '2.2 Les prompts d’orfèvre : Lumière de cinéma, textures de peau et optiques',
            duration: '32 min',
            type: 'video',
            summary: 'Le vocabulaire optique professionnel (anamorphic lens, rim lighting, volumetric dust, 35mm Arri Alexa) appliqué aux modèles d’IA.',
            contentHtml: `
              <p>Oubliez les prompts vagues comme "hyperrealistic 8k". Les vrais directeurs artistiques emploient le langage cinématographique des directeurs de la photographie : types d'éclairage (key light, rim light, golden hour), focales (50mm f/1.4, 85mm portrait) et textures de matières (velours, or brossé, verre sablé).</p>
            `,
            keyTakeaways: [
              'Les descripteurs optiques remplacent les superlatifs artificiels.',
              'L’éclairage en contre-jour (rim lighting) donne instantanément un cachet haut de gamme.',
              'Spécifier les textures (porosité de la peau, reflets métalliques) évite l’effet plastique de l’IA.'
            ],
            downloads: [
              { name: 'Grimoire_Prompts_Optiques_Luxe.pdf', type: 'PROMPTS', size: '3.1 Mo', description: 'Lexique bilingue Français/Anglais des termes optiques et lumière.' }
            ]
          }
        ]
      },
      {
        id: 'mod-3',
        order: 3,
        title: 'Module 3 : Animation Vidéo & Mouvement de Caméra Cinématographique',
        description: 'Prendre le contrôle total des générateurs vidéo : Runway Gen-3, Kling, Luma et le motion brush.',
        lessons: [
          {
            id: 'les-3-1',
            moduleId: 'mod-3',
            title: '3.1 Maîtriser les mouvements de caméra (Pan, Tilt, Zoom, Dolly, Orbit)',
            duration: '40 min',
            type: 'video',
            summary: 'Contrôler la vitesse et la trajectoire des caméras virtuelles pour un résultat organique et réaliste.',
            contentHtml: `
              <p>Dans ce module central, nous étudions comment injecter de l'intention dans les moteurs vidéo. Un zoom trop rapide trahit immédiatement un effet informatique. Un léger travelling latéral avec flou d'arrière-plan donne une facture cinéma digne de Hollywood.</p>
            `,
            keyTakeaways: [
              'Privilégier les mouvements lents et subtils pour une publicité de luxe.',
              'Utiliser le pinceau de mouvement (motion brush) pour isoler les éléments à animer.',
              'Ne jamais cumuler 3 mouvements contradictoires dans un même prompt d’animation.'
            ]
          },
          {
            id: 'les-3-2',
            moduleId: 'mod-3',
            title: '3.2 Animation des visages, micro-expressions et regards captivants',
            duration: '30 min',
            type: 'video',
            summary: 'Donner vie aux personnages : sourires subtils, battements de cils et port de tête sans artefacts.',
            contentHtml: `
              <p>Les yeux sont le miroir de l’âme et le centre d’attention du spectateur. Faith Ariola vous montre comment doser le paramètre de force de mouvement pour conserver la netteté de l’iris et la délicatesse des lèvres.</p>
            `,
            keyTakeaways: [
              'Paramétrer une intensité de mouvement modérée (motion 2 à 4 selon les outils).',
              'Vérifier les clignements des yeux pour éviter les scintillements parasites.'
            ]
          }
        ]
      },
      {
        id: 'mod-4',
        order: 4,
        title: 'Module 4 : Voix Off Émotionnelle, Sound Design & Musique IA',
        description: 'Concevoir l’habillage sonore : voix humaines hyperréalistes, bruitages immersifs et mélodies originales.',
        lessons: [
          {
            id: 'les-4-1',
            moduleId: 'mod-4',
            title: '4.1 Générer une voix off chaleureuse avec le bon grain et la bonne intonation',
            duration: '26 min',
            type: 'video',
            summary: 'Clonage éthique, sélection des timbres vocaux et calibrage des respirations et pauses dramatiques.',
            contentHtml: `
              <p>Le son représente 50% de l’impact émotionnel d’un film publicitaire. Une voix monocorde tue le meilleur visuel du monde. Vous apprendrez à insérer des balises de ponctuation et des indications d'inflexion pour obtenir une voix off chaleureuse et persuasive.</p>
            `,
            keyTakeaways: [
              'Les virgules et les points de suspension créent le rythme naturel de la parole.',
              'Ajuster la stabilité et la clarté dans ElevenLabs pour éviter les artefacts métalliques.'
            ],
            downloads: [
              { name: 'Scripts_Exemples_Voix_Off_Publicite.pdf', type: 'PDF', size: '850 Ko', description: 'Scripts types pour spots télé et réseaux sociaux.' }
            ]
          },
          {
            id: 'les-4-2',
            moduleId: 'mod-4',
            title: '4.2 Foley, SFX et mixage immersif pour donner du poids à chaque image',
            duration: '29 min',
            type: 'video',
            summary: 'Ajouter les bruits de pas, le tintement de l’or, le froissement de la soie et le souffle du vent.',
            contentHtml: `
              <p>Chaque geste à l’écran doit résonner dans l’oreille du spectateur. Nous abordons la superposition des pistes audio : la voix au premier plan, les effets sonores contextuels (foley) au centre, et la nappe musicale en soutien émotionnel.</p>
            `,
            keyTakeaways: [
              'Règle du ducking audio : baisser la musique de 12dB lorsque la voix s’exprime.',
              'Utiliser des bruitages concrets pour ancrer la réalité des éléments générés par IA.'
            ]
          }
        ]
      },
      {
        id: 'mod-5',
        order: 5,
        title: 'Module 5 : Montage Rythmique, Colorimétrie & Export de Maître',
        description: 'L’art du montage final : cut rythmique, étalonnage de luxe et formats d’exportation pour la diffusion.',
        lessons: [
          {
            id: 'les-5-1',
            moduleId: 'mod-5',
            title: '5.1 L’assemblage sur la timeline et le rythme publicitaire',
            duration: '38 min',
            type: 'video',
            summary: 'Monter sur les battements de la musique, gérer les temps forts et éliminer tout temps mort.',
            contentHtml: `
              <p>Nous montons ensemble un projet complet de A à Z. Vous découvrirez les coupes invisibles, l'utilisation des transitions de vitesse (speed ramps) et la disposition des titrages et typographies de marque.</p>
            `,
            keyTakeaways: [
              'Couper sur le mouvement plutôt que sur une image statique.',
              'Respecter les zones de sécurité (safe zones) pour les réseaux sociaux.'
            ]
          },
          {
            id: 'les-5-2',
            moduleId: 'mod-5',
            title: '5.2 Color grading (étalonnage) et finalisation d’un spot prêt pour la marque',
            duration: '34 min',
            type: 'video',
            summary: 'Harmoniser les teintes, enrichir les ombres dorées et exporter en 4K UHD avec le profil idéal.',
            contentHtml: `
              <p>Dernière étape cruciale : uniformiser la colorimétrie de plans issus de moteurs différents pour qu'ils semblent avoir été tournés avec la même caméra de cinéma.</p>
            `,
            keyTakeaways: [
              'Application d’une LUT cinématographique subtile (30-40% d’opacité).',
              'Exportation en ProRes ou H.264 haute qualité bitrate 25Mbps.'
            ],
            downloads: [
              { name: 'Pack_LUTs_DJIFFA_Or_et_Obsidienne.cube', type: 'ASSET', size: '4.2 Mo', description: 'Les LUTs de colorimétrie exclusives de Faith Ariola.' }
            ],
            exercise: {
              title: 'Projet Final de Certification : Créez votre spot publicitaire complet de 15 à 30 secondes',
              instructions: 'En appliquant l’ensemble de La Méthode Faith Ariola, réalisez un spot publicitaire pour une marque réelle ou fictive. Rédigez le script, générez les plans cohérents, intégrez la voix off et le sound design, et assemblez le projet.',
              deliverable: 'Lien vidéo ou fichier exporté + Document de présentation du concept et des prompts utilisés.',
              criteria: [
                'Continuité visuelle irréprochable du personnage ou produit',
                'Qualité du sound design et clarté de la voix off',
                'Rythme du montage et respect de la direction artistique',
                'Présence d’un appel à l’action clair'
              ],
              modelCorrection: 'Votre travail sera évalué selon le barème officiel de DJIFFA DESIGN AGENCY pour la délivrance du Certificat d’Excellence.'
            }
          }
        ]
      }
    ],
    finalQuiz: [
      {
        id: 'fq-1',
        question: 'Quelle est la première étape indispensable avant d’écrire un moindre prompt d’image dans la méthode Faith Ariola ?',
        options: [
          'Définir le concept stratégique, l’émotion centrale et le découpage narratif.',
          'Acheter immédiatement un abonnement annuel à tous les logiciels du marché.',
          'Télécharger des musiques au hasard sur Internet.',
          'Dessiner un logo temporaire.'
        ],
        correctIndex: 0,
        explanation: 'Sans concept et sans découpage technique clair, les générations IA sont décousues et ne répondent à aucun objectif commercial de marque.'
      },
      {
        id: 'fq-2',
        question: 'Comment assurer une continuité visuelle entre plusieurs plans d’un même personnage ?',
        options: [
          'En utilisant des ancres faciales stables, une planche de référence et les mêmes descripteurs de lumière.',
          'En changeant de style à chaque nouveau plan.',
          'En tapant uniquement "même personne" dans le prompt.',
          'Ce n’est pas possible avec l’IA.'
        ],
        correctIndex: 0,
        explanation: 'La rigueur des ancres descriptives et l’emploi d’images sources de référence permettent d’aligner l’identité du sujet tout au long de la vidéo.'
      },
      {
        id: 'fq-3',
        question: 'Quel équilibre sonore est préconisé pour un spot publicitaire percutant ?',
        options: [
          'Voix off claire au premier plan, foley/bruitages contextuels et musique duckée sous la voix.',
          'Musique au volume maximum pour masquer les bruits d’ambiance.',
          'Aucun son pour que la vidéo reste silencieuse.',
          'Seulement des bruitages sans musique ni voix.'
        ],
        correctIndex: 0,
        explanation: 'Le mixage hiérarchisé (ducking) permet à l’oreille de saisir le message tout en étant enveloppée par l’émotion musicale et le réalisme des bruitages.'
      }
    ]
  },
  {
    id: 'course-mode-virtuelle-ia',
    slug: 'mode-virtuelle-et-creation-ia',
    title: 'Mode Virtuelle et Création IA : Mannequins, Collections & Défilés Numériques',
    subtitle: 'Créez des mannequins photoréalistes, des tenues haute couture et des lookbooks pour les maisons de couture et marques de mode.',
    description: 'Une formation spécialisée pour stylistes, créateurs de mode et designers 3D. Concevez des mannequins virtuels aux morphologies variées, habillez-les de textiles somptueux (soie, pagne tissé, wax, velours, cuir brodé d’or), créez des catalogues éditoriaux de prestige et produisez des défilés de mode vidéo virtuels.',
    domain: 'virtual_fashion_ai',
    level: 'Intermédiaire',
    duration: '18 heures de formation · 4 modules',
    modulesCount: 4,
    lessonsCount: 12,
    priceXOF: 95000,
    originalPriceXOF: 135000,
    priceEUR: 145,
    priceUSD: 160,
    coverImage: BRAND_IMAGES.courseFashion,
    isFeatured: true,
    isPublished: true,
    certificateEligible: true,
    objectives: [
      'Générer des mannequins virtuels avec une diversité de teintes de peau et de morphologies réalistes.',
      'Rendre le tombé des tissus et les textures textiles avec une précision tactile.',
      'Concevoir des lookbooks éditoriaux complets conformes aux standards de Vogue et Elle.',
      'Animer des défilés de mode en vidéo pour les lancements de collections.'
    ],
    skillsAcquired: [
      'Design textile virtuel & drapé assisté par IA',
      'Création d’avatars mannequins haute fidélité',
      'Direction artistique de lookbooks de mode',
      'Animation de catwalks & vidéos promotionnelles pour marques de couture'
    ],
    resourcesIncluded: [
      'Catalogue de 80 textures textiles africaines et haute couture modélisées pour l’IA',
      'Templates de grilles de mise en page de lookbooks numériques',
      'Guides des poses éditoriales de mannequinat professionnel'
    ],
    modules: [
      {
        id: 'mf-1',
        order: 1,
        title: 'Module 1 : Mannequinat Virtuel & Identité des Modèles',
        description: 'Morphologies, poses de haute couture et diversité éditoriale.',
        lessons: [
          {
            id: 'mf-1-1',
            moduleId: 'mf-1',
            title: '1.1 Anatomie et poses de catwalk pour l’IA',
            duration: '25 min',
            type: 'video',
            summary: 'Comment maîtriser la posture, l’attitude et le regard des modèles virtuels.',
            contentHtml: '<p>Comprendre les codes du mannequinat d’élite et les transposer dans les paramètres d’IA.</p>',
            keyTakeaways: ['Privilégier les lignes épurées et la tension dans les poses de défilé.']
          }
        ]
      },
      {
        id: 'mf-2',
        order: 2,
        title: 'Module 2 : Création de Tenues & Textures Textiles Riches',
        description: 'Broderies, dentelles, soies, velours et textiles patrimoniaux.',
        lessons: [
          {
            id: 'mf-2-1',
            moduleId: 'mf-2',
            title: '2.1 Rendre le tombé des matières et les reflets métalliques dorés',
            duration: '32 min',
            type: 'video',
            summary: 'Technique pour reproduire le chatoiement des étoffes et les détails microscopiques de tissage.',
            contentHtml: '<p>Le prompt parfait pour la simulation physique des textiles haut de gamme.</p>',
            keyTakeaways: ['Utiliser les descripteurs de grammage et de transparence lumineuse.']
          }
        ]
      }
    ],
    finalQuiz: [
      {
        id: 'q-mf-1',
        question: 'Quel élément fait la différence entre un vêtement IA médiocre et un vêtement de haute couture réaliste ?',
        options: [
          'La justesse du tombé textile, les plis sous tension et la texture microscopique de la matière.',
          'La couleur rouge vif appliquée sur tous les vêtements.',
          'L’utilisation exclusive d’un filtre noir et blanc.',
          'L’absence totale d’éclairage sur la scène.'
        ],
        correctIndex: 0,
        explanation: 'Le réalisme dans la mode dépend du comportement naturel du tissu selon son poids, son tissage et la façon dont la lumière frappe ses fibres.'
      }
    ]
  },
  {
    id: 'course-cinema-storytelling-ia',
    slug: 'cinema-et-storytelling-ia',
    title: 'Cinéma & Storytelling IA : Écriture, Réalisation de Court-Métrages & Séries',
    subtitle: 'Écrivez des histoires captivantes, construisez des univers narratifs et réalisez vos films indépendants avec l’IA.',
    description: 'Une formation complète pour cinéastes, auteurs et passionnés du 7ème art. De la genèse de l’intrigue à la construction d’arches dramatiques profondes, en passant par le cadrage anamorphic, la continuité de scènes complexes et la production d’un court-métrage cinématographique complet.',
    domain: 'cinema_storytelling_ai',
    level: 'Avancé',
    duration: '22 heures de formation · 5 modules',
    modulesCount: 5,
    lessonsCount: 15,
    priceXOF: 110000,
    originalPriceXOF: 150000,
    priceEUR: 165,
    priceUSD: 180,
    coverImage: BRAND_IMAGES.courseCinema,
    isFeatured: true,
    isPublished: true,
    certificateEligible: true,
    objectives: [
      'Structurer une dramaturgie en 3 actes adaptée aux formats de diffusion modernes.',
      'Garantir la continuité des personnages, décors et ambiances lumineuses sur un film entier.',
      'Gérer les scènes d’action, dialogues intimistes et plans de coupe narratifs.',
      'Présenter son film en festival ou plateforme de streaming numérique.'
    ],
    skillsAcquired: [
      'Scénarisation cinématographique de fiction',
      'Direction d’acteurs virtuels',
      'Continuité d’univers fantastique, historique ou contemporain',
      'Réalisation & post-production de court-métrage IA'
    ],
    resourcesIncluded: [
      'Modèle de scénario standard international (Format Final Draft / PDF)',
      'Guide des transitions de montage cinématographiques',
      'Dossier de production type pour soumission en festival de films IA'
    ],
    modules: [
      {
        id: 'cin-1',
        order: 1,
        title: 'Module 1 : Scénarisation & Arches Dramatiques',
        description: 'Développer des personnages mémorables et des conflits narratifs poignants.',
        lessons: [
          {
            id: 'cin-1-1',
            moduleId: 'cin-1',
            title: '1.1 Le voyage du héros appliqué au cinéma court',
            duration: '30 min',
            type: 'video',
            summary: 'Comment captiver le spectateur dès les 30 premières secondes et maintenir la tension.',
            contentHtml: '<p>Analyse de courts-métrages primés et déconstruction de leur squelette dramatique.</p>',
            keyTakeaways: ['Créer une faille émotionnelle chez le protagoniste.']
          }
        ]
      }
    ]
  },
  {
    id: 'course-entrepreneuriat-digital-ia',
    slug: 'entrepreneuriat-et-activites-numeriques-ia',
    title: 'Entrepreneuriat & Monétisation : Lancer son Agence de Services Créatifs IA',
    subtitle: 'Transformez vos compétences IA en activité rentable : offres irrésistibles, prospection de marques et contrats internationaux.',
    description: 'Avoir du talent ne suffit pas : il faut savoir le vendre au prix fort. Ce programme pratique vous apprend à structurer vos offres de création vidéo, branding et mode virtuelle, à fixer vos tarifs en devises fortes, à prospecter les entreprises locales et internationales, et à bâtir une agence numérique prospère depuis l’Afrique.',
    domain: 'digital_business',
    level: 'Tous niveaux',
    duration: '16 heures de formation · 4 modules',
    modulesCount: 4,
    lessonsCount: 10,
    priceXOF: 85000,
    originalPriceXOF: 120000,
    priceEUR: 130,
    priceUSD: 140,
    coverImage: BRAND_IMAGES.faithPortrait,
    isFeatured: true,
    isPublished: true,
    certificateEligible: true,
    objectives: [
      'Packager ses compétences créatives en offres de services à haute valeur ajoutée.',
      'Calculer ses prix avec rentabilité et éviter le piège des tarifs dérisoires.',
      'Mettre en place un système de prospection LinkedIn, Instagram et email B2B.',
      'Rédiger des propositions commerciales et contrats de cession de droits d’auteur solides.'
    ],
    skillsAcquired: [
      'Packaging d’offres créatives B2B',
      'Négociation commerciale et closing client',
      'Gestion financière et encaissement multi-devises (Mobile Money & Wire international)',
      'Structuration d’une agence créative rentable'
    ],
    resourcesIncluded: [
      'Modèle de contrat de prestation créative DJIFFA DESIGN AGENCY rédigé par juriste',
      'Fichier Excel calculateur de tarification au forfait et à la journée',
      'Scripts de messages de prospection B2B testés pour marques et annonceurs'
    ],
    modules: [
      {
        id: 'ent-1',
        order: 1,
        title: 'Module 1 : Positionnement & Offres de Services Créatifs',
        description: 'Comment se positionner en partenaire stratégique plutôt qu’en simple exécutant.',
        lessons: [
          {
            id: 'ent-1-1',
            moduleId: 'ent-1',
            title: '1.1 Définir une offre signature que les marques ne peuvent refuser',
            duration: '27 min',
            type: 'video',
            summary: 'Pourquoi vendre la transformation commerciale plutôt que le temps passé.',
            contentHtml: '<p>Exemples concrets d’offres vendues entre 500 000 FCFA et 3 000 000 FCFA à des entreprises.</p>',
            keyTakeaways: ['Vendre le résultat commercial (ventes, visibilité) et non les outils techniques.']
          }
        ]
      }
    ]
  }
];

export const COACHING_PROGRAMS: CoachingProgramConfig[] = [
  {
    id: 'coaching-vip-individuel',
    type: 'individual' as const,
    title: 'Accompagnement Individuel VIP avec Faith Ariola',
    subtitle: 'Immersion sur-mesure d’un mois pour concrétiser votre grand projet ou propulser votre agence.',
    badge: 'Sur sélection · Places très limitées',
    priceXOF: 450000,
    priceEUR: 690,
    priceUSD: 750,
    duration: '4 semaines · 4 sessions individuelles en direct (1h30 chacune)',
    features: [
      'Audit personnalisé approfondi de votre travail et de votre portfolio',
      'Séances privées 1-on-1 en visio haute définition avec Faith Ariola',
      'Accès direct WhatsApp privé avec Faith pendant toute la durée du programme',
      'Revue technique et corrections en direct de vos prompts et montages',
      'Validation de vos offres commerciales et stratégie de tarification client',
      'Attestation d’accompagnement d’élite signée par la Direction DJIFFA'
    ],
    targetAudience: 'Pour entrepreneurs, créateurs confirmés et professionnels désireux d’un bond en avant immédiat.'
  },
  {
    id: 'coaching-mastermind-collectif',
    type: 'collective' as const,
    title: 'Mastermind & Bootcamp Collectif (Cohorte)',
    subtitle: 'Une émulation collective avec un groupe restreint de 12 créateurs ambitieux.',
    badge: 'Prochaine cohorte en cours d’inscription',
    priceXOF: 180000,
    priceEUR: 280,
    priceUSD: 300,
    duration: '6 semaines · Ateliers hebdomadaires live & exercices de groupe',
    features: [
      '6 masterclasses hebdomadaires de 2 heures en direct avec questions/réponses',
      'Défis créatifs hebdomadaires notés avec retours détaillés de l’équipe pédagogique',
      'Groupe privé de networking des talents DJIFFA ACADEMY',
      'Projet collectif d’envergure avec mise en situation réelle pour une marque partenaire',
      'Enregistrements vidéo disponibles en replay à vie',
      'Certificat de complétion de Bootcamp de haute valeur'
    ],
    targetAudience: 'Pour débutants et intermédiaires voulant un cadre structuré et l’énergie d’un groupe motivant.'
  }
];

export const FAQ_ITEMS = [
  {
    question: 'Comment se passe l’accès aux formations après l’achat ?',
    answer: 'Dès confirmation de votre paiement (par MTN Mobile Money, Moov Money ou carte bancaire), votre accès est débloqué automatiquement et immédiatement. Vous retrouvez votre formation dans votre espace personnel, accessible 24h/24, 7j/7, sur smartphone, tablette et ordinateur.'
  },
  {
    question: 'Ai-je besoin d’un ordinateur surpuissant pour suivre les formations ?',
    answer: 'Non ! C’est toute la magie des technologies d’intelligence artificielle actuelles : la majorité des calculs lourds se font sur les serveurs distants dans le cloud. Un ordinateur portable standard ou même une bonne tablette avec une connexion internet stable suffisent amplement.'
  },
  {
    question: 'Quels sont les moyens de paiement acceptés pour le Bénin et l’international ?',
    answer: 'Au Bénin et en Afrique de l’Ouest/Centrale, nous acceptons MTN Mobile Money, Moov Money, Orange Money et Wave via nos passerelles sécurisées (FedaPay, KKiaPay, CinetPay). Pour nos apprenants en Europe, aux États-Unis et dans le reste du monde, les cartes bancaires internationales Visa et Mastercard sont acceptées sans frais cachés.'
  },
  {
    question: 'Les formations donnent-elles droit à un certificat ?',
    answer: 'Oui. Chaque formation terminée à 100% avec validation des quiz et des exercices pratiques donne droit au Certificat Officiel d’Aptitude de DJIFFA ACADEMY, signé par Faith Ariola, Directrice de DJIFFA DESIGN AGENCY, muni d’un numéro unique de vérification traçable.'
  },
  {
    question: 'Puis-je contacter la formatrice si j’ai des questions durant mes cours ?',
    answer: 'Absolument. Un espace dédié sous chaque leçon permet de poser vos questions et de soumettre vos travaux. Pour un accompagnement rapproché ou un suivi sur-mesure de vos projets clients, nous proposons également nos formules d’Accompagnement Personnalisé Individuel ou Collectif.'
  },
  {
    question: 'Dois-je souscrire un abonnement mensuel ?',
    answer: 'Non, chez DJIFFA ACADEMY, la liberté est totale. Chaque formation s’achète individuellement avec un paiement unique. Aucun abonnement récurrent n’est imposé. Vous conservez votre accès selon les conditions du programme.'
  }
];

export const INITIAL_DOMAINS: DomainCategory[] = [
  {
    id: 'video_ads_ai',
    code: '01',
    title: 'Création Vidéo & Publicité IA',
    shortLabel: 'Vidéo Publicitaire IA',
    description: 'L’art de concevoir des spots publicitaires, des campagnes de marque cinématiques et des contenus commerciaux captivants.',
    skills: [
      'Scénarisation publicitaire & storyboards précis',
      'Création d’images photoréalistes & décors de marque',
      'Animation des personnages & mouvements de caméra fluides',
      'Voix off de synthèse émotionnelles & sound design de luxe',
      'Montage rythmique & export pour diffusion TV / réseaux'
    ],
    highlightCourseId: 'course-faith-ariola-methode'
  },
  {
    id: 'virtual_fashion_ai',
    code: '02',
    title: 'Mode Virtuelle & Création IA',
    shortLabel: 'Mode Virtuelle IA',
    description: 'Révolutionnez l’univers du textile et de la haute couture grâce aux mannequins virtuels et aux collections numériques.',
    skills: [
      'Création de mannequins virtuels aux morphologies variées',
      'Conception de tenues et rendus de matières (soie, pagne, velours)',
      'Lookbooks éditoriaux conformes aux standards des magazines',
      'Défilés de mode vidéo virtuels pour marques de couture',
      'Campagnes publicitaires pour stylistes & créateurs'
    ],
    highlightCourseId: 'course-mode-virtuelle-ia'
  },
  {
    id: 'cinema_storytelling_ai',
    code: '03',
    title: 'Cinéma & Storytelling IA',
    shortLabel: 'Cinéma & Fiction IA',
    description: 'Écrivez des récits profonds, réalisez vos court-métrages indépendants et produisez des univers narratifs saisissants.',
    skills: [
      'Écriture dramatique & développement d’univers narratifs',
      'Continuité visuelle absolue de personnages et de décors',
      'Cadrage anamorphic, éclairages de plateau & scènes d’action',
      'Direction d’acteurs virtuels et dialogues synchronisés',
      'Préparation de dossiers pour festivals et plateformes'
    ],
    highlightCourseId: 'course-cinema-storytelling-ia'
  },
  {
    id: 'digital_business',
    code: '04',
    title: 'Entrepreneuriat & Activités Numériques',
    shortLabel: 'Entrepreneuriat Digital',
    description: 'Convertissez vos compétences créatives en offres professionnelles hautement rémunératrices.',
    skills: [
      'Packaging d’offres de services créatifs irrésistibles',
      'Fixation des prix en monnaies fortes & rentabilité de mission',
      'Prospection de marques locales et internationales',
      'Contrats de prestation, droits d’auteur & encaissement sécurisé',
      'Création d’une agence créative pérenne depuis l’Afrique'
    ],
    highlightCourseId: 'course-entrepreneuriat-digital-ia'
  }
];

export const INITIAL_PROMO_CODES: PromoCode[] = [
  {
    id: 'promo-1',
    code: 'DJIFFA2026',
    discountPercent: 10,
    isActive: true,
    description: 'Offre de bienvenue (10% de réduction)'
  },
  {
    id: 'promo-2',
    code: 'FAITH10',
    discountPercent: 10,
    isActive: true,
    description: 'Code privilège Faith Ariola'
  }
];

export const INITIAL_SITE_SETTINGS: SiteSettings = {
  agencyLogoDataUrl: null,
  academyName: 'DJIFFA ACADEMY',
  parentAgencyName: 'DJIFFA DESIGN AGENCY',
  directorName: 'Faith Ariola',
  academyPresentation:
    'DJIFFA ACADEMY forme les créateurs, entrepreneurs et professionnels en Afrique et à l’international. Transformez des concepts audacieux en spots publicitaires cinématographiques, collections de mode virtuelles et opportunités professionnelles hautement rémunératrices.',
  parentAgencyPresentation:
    'Maison mère fondée par Faith Ariola à Cotonou, DJIFFA DESIGN AGENCY est un studio de création visuelle et de stratégie digitale spécialisé dans les campagnes publicitaires, le luxe et l’intelligence artificielle appliquée aux marques.',
  directorBio:
    'Directrice de création et entrepreneure visionnaire, Faith Ariola a fondé DJIFFA DESIGN AGENCY avec une ambition limpide : positionner l’Afrique au premier rang de la révolution des industries créatives assistées par l’intelligence artificielle. Elle accompagne des marques de prestige, des stylistes et des créateurs vers l’excellence visuelle et l’indépendance financière.',
  contactEmail: 'universdjiffaariola@gmail.com',
  contactPhone: '+229 97 00 00 00',
  whatsappNumber: '+229 97 00 00 00',
  headquarters: 'Cotonou, République du Bénin',
  supportHours: 'Lundi – Vendredi : 08h30 – 19h00 (GMT+1) · Samedi : 09h00 – 14h00',
  instagramUrl: 'https://instagram.com',
  linkedinUrl: 'https://linkedin.com',
  youtubeUrl: 'https://youtube.com',
  legalNotices:
    'Éditeur du site : DJIFFA ACADEMY, pôle formation de DJIFFA DESIGN AGENCY.\nDirectrice de publication : Faith Ariola.\nSiège social : Cotonou, République du Bénin.\nContact officiel : universdjiffaariola@gmail.com.\nPropriété intellectuelle : L’ensemble des formations, vidéos, prompts, supports PDF et visuels publiés sur DJIFFA ACADEMY sont protégés par les lois relatives à la propriété intellectuelle. Toute reproduction ou diffusion non autorisée est strictement interdite.',
  termsOfSale:
    '1. Objet : Les présentes Conditions Générales de Vente régissent l’achat individuel des formations certifiantes et programmes d’accompagnement sur DJIFFA ACADEMY.\n2. Tarifs & Monnaies : Les prix sont exprimés principalement en FCFA (XOF), avec équivalents indicatifs en EUR et USD. Aucun abonnement mensuel automatique n’est appliqué.\n3. Paiement & Activation : Les paiements sont traités via nos prestataires sécurisés (MTN Mobile Money, Moov Money, Visa, Mastercard via FedaPay / KKiaPay / CinetPay). L’accès aux contenus numériques est activé uniquement après confirmation réelle de la transaction par le prestataire.\n4. Accès personnel : L’accès est strictement personnel et nominatif.\n5. Assistance : Toute réclamation ou demande d’accompagnement s’effectue via l’adresse email officielle de la Direction.'
};

