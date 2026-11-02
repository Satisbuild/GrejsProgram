/* Øvelsesbibliotek og standardrutiner.
   Navnene fra den gamle version SKAL bevares uændret: migreringen finder øvelser på navn. */
var TL = (globalThis.TL = globalThis.TL || {});

(() => {
  const MUSCLES = {
    bryst: "Bryst", ryg: "Ryg", skuldre: "Skuldre", biceps: "Biceps", triceps: "Triceps",
    underarme: "Underarme", mave: "Mave", forlaar: "Forlår", baglaar: "Baglår",
    balder: "Balder", laeg: "Læg", cardio: "Cardio", andet: "Andet",
  };

  const EQUIPMENT = {
    stang: "Stang", haandvaegt: "Håndvægt", maskine: "Maskine", kabel: "Kabel",
    smith: "Smith", kropsvaegt: "Kropsvægt", kettlebell: "Kettlebell", elastik: "Elastik",
    cardio: "Cardio", andet: "Andet",
  };

  /* Sporingstyper - bestemmer hvilke kolonner et sæt har.
     wr: kg + reps | bwx: kropsvægt med evt. ekstra kg + reps | bw: kun reps
     time: varighed | cardio: distance + varighed */
  const TYPES = {
    wr: { label: "Vægt og reps", fields: ["kg", "reps"] },
    bwx: { label: "Kropsvægt + ekstra vægt", fields: ["kg", "reps"] },
    bw: { label: "Kun reps", fields: ["reps"] },
    time: { label: "Varighed", fields: ["secs"] },
    cardio: { label: "Distance og tid", fields: ["km", "secs"] },
  };

  // [navn, muskel, udstyr, standard-reps, sporingstype (default wr), sekundære muskler]
  const ROWS = [
    // Bryst
    ["Bænkpres (tung)", "bryst", "stang", "3-5", "wr", ["triceps", "skuldre"]],
    ["Bænkpres (stang)", "bryst", "stang", "5-8", "wr", ["triceps", "skuldre"]],
    ["Pause-bænk", "bryst", "stang", "5-7", "wr", ["triceps", "skuldre"]],
    ["Bænkpres (håndvægte)", "bryst", "haandvaegt", "6-10", "wr", ["triceps", "skuldre"]],
    ["Bænkpres (maskine)", "bryst", "maskine", "6-10", "wr", ["triceps", "skuldre"]],
    ["Bænkpres (Smith)", "bryst", "smith", "6-10", "wr", ["triceps", "skuldre"]],
    ["Incline bænkpres (stang)", "bryst", "stang", "5-8", "wr", ["triceps", "skuldre"]],
    ["Incline bænkpres (håndvægte)", "bryst", "haandvaegt", "6-10", "wr", ["triceps", "skuldre"]],
    ["Incline bænkpres (maskine)", "bryst", "maskine", "5-7", "wr", ["triceps", "skuldre"]],
    ["Incline bænkpres (Smith)", "bryst", "smith", "6-10", "wr", ["triceps", "skuldre"]],
    ["Decline bænkpres", "bryst", "stang", "6-10", "wr", ["triceps"]],
    ["Chest press (maskine)", "bryst", "maskine", "8-12", "wr", ["triceps"]],
    ["Flyes – fokus øvre bryst", "bryst", "haandvaegt", "5-7"],
    ["Flyes (håndvægte)", "bryst", "haandvaegt", "8-12"],
    ["Cable flyes (lav til høj)", "bryst", "kabel", "10-12"],
    ["Cable flyes (høj til lav)", "bryst", "kabel", "10-12"],
    ["Pec deck (maskine)", "bryst", "maskine", "10-12"],
    ["Dips (bryst)", "bryst", "kropsvaegt", "6-12", "bwx", ["triceps"]],
    ["Push ups", "bryst", "kropsvaegt", "AMRAP", "bwx", ["triceps"]],
    // Skuldre
    ["Skulderpres (håndvægte)", "skuldre", "haandvaegt", "6-10", "wr", ["triceps"]],
    ["Skulderpres (maskine)", "skuldre", "maskine", "8-12", "wr", ["triceps"]],
    ["Militærpres (stang)", "skuldre", "stang", "5-8", "wr", ["triceps"]],
    ["Arnold press", "skuldre", "haandvaegt", "8-12", "wr", ["triceps"]],
    ["Lateral raise (maskine)", "skuldre", "maskine", "7-10"],
    ["Lateral raise (håndvægte)", "skuldre", "haandvaegt", "10-15"],
    ["Cable lateral raise", "skuldre", "kabel", "10-15"],
    ["Front raise", "skuldre", "haandvaegt", "10-12"],
    ["Reverse pec deck", "skuldre", "maskine", "12-15", "wr", ["ryg"]],
    ["Face pull", "skuldre", "kabel", "10-12", "wr", ["ryg"]],
    ["Upright row", "skuldre", "kabel", "8-12"],
    ["Shrugs (håndvægte)", "skuldre", "haandvaegt", "10-12", "wr", ["ryg"]],
    // Triceps
    ["Close grip bænk (Smith) – triceps", "triceps", "smith", "7-10", "wr", ["bryst"]],
    ["Close grip bænkpres", "triceps", "stang", "6-10", "wr", ["bryst"]],
    ["Triceps pushdown", "triceps", "kabel", "8-12"],
    ["Triceps pushdown (reb)", "triceps", "kabel", "10-12"],
    ["Overhead triceps ext. (reb)", "triceps", "kabel", "10-12"],
    ["Skullcrusher", "triceps", "stang", "8-12"],
    ["Triceps ext. (maskine)", "triceps", "maskine", "8-12"],
    ["Triceps kickback", "triceps", "haandvaegt", "10-15"],
    ["Dips (triceps)", "triceps", "kropsvaegt", "6-12", "bwx", ["bryst"]],
    // Ryg
    ["Lat pullover", "ryg", "kabel", "10-12"],
    ["T-bar row", "ryg", "stang", "5-8", "wr", ["biceps"]],
    ["Barbell row", "ryg", "stang", "6-10", "wr", ["biceps"]],
    ["Håndvægt row (1-arms)", "ryg", "haandvaegt", "8-12", "wr", ["biceps"]],
    ["Chest supported row", "ryg", "maskine", "8-12", "wr", ["biceps"]],
    ["Seated cable row", "ryg", "kabel", "8-12", "wr", ["biceps"]],
    ["Machine row", "ryg", "maskine", "8-12", "wr", ["biceps"]],
    ["Lat pulldown", "ryg", "kabel", "8-10", "wr", ["biceps"]],
    ["Lat pulldown (smalt greb)", "ryg", "kabel", "8-12", "wr", ["biceps"]],
    ["Pull ups", "ryg", "kropsvaegt", "AMRAP", "bwx", ["biceps"]],
    ["Chin ups", "ryg", "kropsvaegt", "AMRAP", "bwx", ["biceps"]],
    ["Straight arm pulldown", "ryg", "kabel", "10-12"],
    ["Rack pull", "ryg", "stang", "5-8", "wr", ["balder", "baglaar"]],
    ["Dødløft", "ryg", "stang", "3-6", "wr", ["baglaar", "balder"]],
    ["Hyperextension", "ryg", "kropsvaegt", "10-15", "bwx", ["balder", "baglaar"]],
    ["Shrugs (stang)", "ryg", "stang", "8-12"],
    // Biceps og underarme
    ["Biceps curl", "biceps", "haandvaegt", "8-12", "wr", ["underarme"]],
    ["Biceps curl (stang)", "biceps", "stang", "8-12", "wr", ["underarme"]],
    ["Hammer curl", "biceps", "haandvaegt", "8-12", "wr", ["underarme"]],
    ["Incline curl", "biceps", "haandvaegt", "10-12"],
    ["Preacher curl (maskine)", "biceps", "maskine", "8-12"],
    ["Cable curl", "biceps", "kabel", "10-12"],
    ["Concentration curl", "biceps", "haandvaegt", "10-12"],
    ["Reverse curl", "underarme", "stang", "10-12", "wr", ["biceps"]],
    ["Behind the back forearm", "underarme", "kabel", "8-10"],
    ["Wrist curl", "underarme", "haandvaegt", "12-15"],
    // Ben
    ["Hacksquat", "forlaar", "maskine", "5-8", "wr", ["balder"]],
    ["Squat (stang)", "forlaar", "stang", "5-8", "wr", ["balder", "baglaar"]],
    ["Front squat", "forlaar", "stang", "5-8", "wr", ["balder"]],
    ["Benpres", "forlaar", "maskine", "8-12", "wr", ["balder"]],
    ["Goblet squat", "forlaar", "kettlebell", "8-12", "wr", ["balder"]],
    ["Bulgarian split squat", "forlaar", "haandvaegt", "8-12", "wr", ["balder"]],
    ["Lunges", "forlaar", "haandvaegt", "10-12", "wr", ["balder"]],
    ["Romanian deadlift", "baglaar", "stang", "6-10", "wr", ["balder", "ryg"]],
    ["Lying leg curl", "baglaar", "maskine", "8-10"],
    ["Seated leg curl", "baglaar", "maskine", "8-12"],
    ["Leg extension", "forlaar", "maskine", "8-10"],
    ["Hip thrust", "balder", "stang", "8-12", "wr", ["baglaar"]],
    ["Calf raises", "laeg", "maskine", "8-10"],
    ["Calf raises (siddende)", "laeg", "maskine", "10-15"],
    ["Adduktor (maskine)", "forlaar", "maskine", "12-15"],
    ["Abduktor (maskine)", "balder", "maskine", "12-15"],
    // Mave og andet
    ["Ab crunches (cable)", "mave", "kabel", "8-10"],
    ["Ab machine crunch", "mave", "maskine", "10-15"],
    ["Hanging leg raise", "mave", "kropsvaegt", "8-15", "bwx"],
    ["Plank", "mave", "kropsvaegt", "", "time"],
    ["Russian twist", "mave", "haandvaegt", "15-20"],
    ["Cable woodchopper", "mave", "kabel", "10-12"],
    ["Ekstra sæt – til failure", "andet", "andet", "AMRAP"],
    ["Farmer's walk", "underarme", "haandvaegt", "", "time"],
    // Cardio
    ["Løb", "cardio", "cardio", "", "cardio"],
    ["Løbebånd", "cardio", "cardio", "", "cardio"],
    ["Cykling", "cardio", "cardio", "", "cardio"],
    ["Romaskine", "cardio", "cardio", "", "cardio"],
    ["Crosstrainer", "cardio", "cardio", "", "cardio"],
    ["Trappemaskine", "cardio", "cardio", "", "time"],
    ["Sjippetov", "cardio", "cardio", "", "time"],
    ["Gang på incline", "cardio", "cardio", "", "cardio"],
  ];

  function slug(name) {
    return String(name).toLowerCase()
      .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  const LIBRARY = ROWS.map(([name, muscle, equipment, reps, type, secondary]) => ({
    id: slug(name), name, muscle, equipment, reps: reps || "",
    type: type || "wr", secondary: secondary || [],
  }));

  // [navn, antal sæt, rep-mål (override), superset-gruppe, note]
  const DEFAULT_ROUTINES = [
    { id: "bryst", title: "Bryst", exercises: [
      ["Bænkpres (tung)", 2], ["Pause-bænk", 2], ["Incline bænkpres (maskine)", 4],
      ["Flyes – fokus øvre bryst", 3], ["Close grip bænk (Smith) – triceps", 3],
      ["Lateral raise (maskine)", 4, null, 1], ["Triceps pushdown", 4, null, 1],
    ] },
    { id: "ben", title: "Ben", exercises: [
      ["Hacksquat", 4], ["Lying leg curl", 4], ["Leg extension", 3],
      ["Calf raises", 4, null, 1], ["Ab crunches (cable)", 4, null, 1],
      ["Ekstra sæt – til failure", 1, null, null, "Kør kun hvis der er mere i tanken"],
    ] },
    { id: "ryg", title: "Ryg", exercises: [
      ["Lat pullover", 4], ["T-bar row", 4], ["Lat pulldown", 3], ["Face pull", 3],
      ["Biceps curl", 3], ["Hammer curl", 3], ["Behind the back forearm", 2],
    ] },
  ];

  Object.assign(TL, { MUSCLES, EQUIPMENT, TYPES, LIBRARY, DEFAULT_ROUTINES, slug });
})();
