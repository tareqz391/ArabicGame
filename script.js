// ======================================================
// بنك الأسئلة
// ======================================================

const questionBank = [

  // ====================================================
  // اختيار من متعدد - MCQ
  // ====================================================

  {
    type: "mcq",
    q: "أي جملة مما يلي تُعد جملة اسمية؟",
    answers: [
      "ذهبَ الطالبُ إلى المدرسة",
      "الطالبُ مجتهدٌ",
      "يقرأُ أحمدُ الكتاب",
      "اكتبْ واجبك"
    ],
    correct: 1
  },

  {
    type: "mcq",
    q: "أي جملة تحتوي على مبتدأ وخبر؟",
    answers: [
      "العلمُ نورٌ",
      "كتبَ الطالبُ الدرس",
      "يلعبُ الطفلُ",
      "اذهبْ إلى المدرسة"
    ],
    correct: 0
  },

  {
    type: "mcq",
    q: "أي جملة اسمية تصف السماء؟",
    answers: [
      "السماءُ صافيةٌ",
      "تشرقُ الشمسُ",
      "هطلَ المطرُ",
      "اخرجْ إلى الحديقة"
    ],
    correct: 0
  },

  {
    type: "mcq",
    q: "أي جملة صحيحة لتكوين جملة اسمية؟",
    answers: [
      "مجتهدٌ الطالبُ",
      "الطالبُ مجتهدٌ",
      "يُجتهدُ الطالبُ",
      "اجتهدْ الطالبُ"
    ],
    correct: 1
  },

  {
    type: "mcq",
    q: "أي جملة تتكون من مبتدأ وخبر؟",
    answers: [
      "البيتُ واسعٌ",
      "قرأَ محمدٌ الكتاب",
      "يكتبُ الطالبُ",
      "اكتبْ الدرس"
    ],
    correct: 0
  },

  {
    type: "mcq",
    q: "ما الركنان الأساسيان للجملة الاسمية؟",
    answers: [
      "الفعل والفاعل",
      "المبتدأ والخبر",
      "الفعل والمفعول به",
      "الحال والتمييز"
    ],
    correct: 1
  },

  {
    type: "mcq",
    q: "أي جملة فيها خبر مناسب للمبتدأ «الحديقةُ»؟",
    answers: [
      "الحديقةُ جميلةٌ",
      "جميلةٌ الحديقةُ",
      "يذهبُ الحديقةُ",
      "اكتبْ الحديقةُ"
    ],
    correct: 0
  },

  {
    type: "mcq",
    q: "أي جملة تدل على صفة للطالب؟",
    answers: [
      "الطالبُ نشيطٌ",
      "درسَ الطالبُ",
      "يقرأُ الطالبُ",
      "اكتبْ يا طالب"
    ],
    correct: 0
  },

  {
    type: "mcq",
    q: "أي جملة اسمية صحيحة؟",
    answers: [
      "المعلمُ مخلصٌ",
      "مخلصٌ المعلمُ",
      "يخلصُ المعلمُ",
      "أخلصْ يا معلم"
    ],
    correct: 0
  },

  {
    type: "mcq",
    q: "أي جملة تحتوي على مبتدأ مرفوع وخبر مرفوع؟",
    answers: [
      "العلمُ مفيدٌ",
      "رأيتُ العلمَ",
      "مررتُ بالعلمِ",
      "لن يذهبَ الطالبُ"
    ],
    correct: 0
  },


  // ====================================================
  // ترتيب الجملة الاسمية - REORDER
  // ====================================================

  {
    type: "reorder",
    words: ["الطالبُ", "المجتهدُ", "محبوبٌ"]
  },

  {
    type: "reorder",
    words: ["الحديقةُ", "الواسعةُ", "جميلةٌ"]
  },

  {
    type: "reorder",
    words: ["السماءُ", "صافيةٌ", "اليومَ"]
  },

  {
    type: "reorder",
    words: ["الولدُ", "الصغيرُ", "نشيطٌ"]
  },

  {
    type: "reorder",
    words: ["الكتابُ", "المفيدُ", "جديدٌ"]
  },

  {
    type: "reorder",
    words: ["المعلمُ", "المخلصُ", "محبوبٌ"]
  },

  {
    type: "reorder",
    words: ["البيتُ", "الكبيرُ", "جميلٌ"]
  },

  {
    type: "reorder",
    words: ["الطريقُ", "الطويلُ", "واسعٌ"]
  },

  {
    type: "reorder",
    words: ["اللاعبُ", "السريعُ", "ماهرٌ"]
  },

  {
    type: "reorder",
    words: ["العصفورُ", "الصغيرُ", "جميلٌ"]
  },


  // ====================================================
  // الإعراب - PARSING
  // ====================================================

  // سؤال من 3 أجزاء:
  // 0.5 + 0.25 + 0.25 = 1

  {
    type: "parsing",
    sentence: "الطالبُ المجتهدُ محبوبٌ",

    parts: [
      {
        label: "ما إعراب كلمة «الطالبُ»؟",
        options: [
          "مبتدأ مرفوع",
          "خبر مرفوع",
          "فاعل مرفوع",
          "مفعول به منصوب"
        ],
        correct: 0,
        points: 0.5
      },

      {
        label: "ما إعراب كلمة «المجتهدُ»؟",
        options: [
          "نعت مرفوع",
          "خبر مرفوع",
          "مبتدأ مرفوع",
          "مفعول به منصوب"
        ],
        correct: 0,
        points: 0.25
      },

      {
        label: "ما إعراب كلمة «محبوبٌ»؟",
        options: [
          "مبتدأ مرفوع",
          "خبر مرفوع",
          "نعت مجرور",
          "فاعل مرفوع"
        ],
        correct: 1,
        points: 0.25
      }
    ]
  },


  // سؤال من 3 أجزاء

  {
    type: "parsing",
    sentence: "الحديقةُ جميلةٌ وواسعةٌ",

    parts: [
      {
        label: "ما إعراب كلمة «الحديقةُ»؟",
        options: [
          "مبتدأ مرفوع",
          "خبر مرفوع",
          "فاعل مرفوع",
          "مفعول به"
        ],
        correct: 0,
        points: 0.5
      },

      {
        label: "ما إعراب كلمة «جميلةٌ»؟",
        options: [
          "مبتدأ",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 1,
        points: 0.25
      },

      {
        label: "ما إعراب كلمة «واسعةٌ»؟",
        options: [
          "معطوف مرفوع",
          "مفعول به",
          "فاعل",
          "اسم مجرور"
        ],
        correct: 0,
        points: 0.25
      }
    ]
  },


  // سؤال من 3 أجزاء

  {
    type: "parsing",
    sentence: "العلمُ نورٌ مفيدٌ",

    parts: [
      {
        label: "ما إعراب كلمة «العلمُ»؟",
        options: [
          "مبتدأ مرفوع",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 0,
        points: 0.5
      },

      {
        label: "ما إعراب كلمة «نورٌ»؟",
        options: [
          "مبتدأ",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 1,
        points: 0.25
      },

      {
        label: "ما إعراب كلمة «مفيدٌ»؟",
        options: [
          "نعت مرفوع",
          "مفعول به",
          "فاعل",
          "اسم مجرور"
        ],
        correct: 0,
        points: 0.25
      }
    ]
  },


  // سؤال من 3 أجزاء

  {
    type: "parsing",
    sentence: "الجوُّ جميلٌ اليومَ",

    parts: [
      {
        label: "ما إعراب كلمة «الجوُّ»؟",
        options: [
          "مبتدأ مرفوع",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 0,
        points: 0.5
      },

      {
        label: "ما إعراب كلمة «جميلٌ»؟",
        options: [
          "مبتدأ",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 1,
        points: 0.25
      },

      {
        label: "ما إعراب كلمة «اليومَ»؟",
        options: [
          "ظرف زمان منصوب",
          "مبتدأ",
          "خبر مرفوع",
          "فاعل"
        ],
        correct: 0,
        points: 0.25
      }
    ]
  },


  // سؤال من 3 أجزاء

  {
    type: "parsing",
    sentence: "الولدُ النشيطُ محبوبٌ",

    parts: [
      {
        label: "ما إعراب كلمة «الولدُ»؟",
        options: [
          "مبتدأ مرفوع",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 0,
        points: 0.5
      },

      {
        label: "ما إعراب كلمة «النشيطُ»؟",
        options: [
          "نعت مرفوع",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 0,
        points: 0.25
      },

      {
        label: "ما إعراب كلمة «محبوبٌ»؟",
        options: [
          "خبر مرفوع",
          "مبتدأ",
          "فاعل",
          "نعت مجرور"
        ],
        correct: 0,
        points: 0.25
      }
    ]
  },


  // سؤال من جملتين:
  // 0.5 + 0.5 = 1

  {
    type: "parsing",
    sentence: "الكتابُ مفيدٌ للطالبِ",

    parts: [
      {
        label: "ما إعراب كلمة «الكتابُ»؟",
        options: [
          "مبتدأ مرفوع",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 0,
        points: 0.5
      },

      {
        label: "ما إعراب كلمة «مفيدٌ»؟",
        options: [
          "مبتدأ",
          "خبر مرفوع",
          "فاعل",
          "اسم مجرور"
        ],
        correct: 1,
        points: 0.5
      }
    ]
  },


  // سؤال من جملتين

  {
    type: "parsing",
    sentence: "السماءُ صافيةٌ اليومَ",

    parts: [
      {
        label: "ما إعراب كلمة «السماءُ»؟",
        options: [
          "مبتدأ مرفوع",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 0,
        points: 0.5
      },

      {
        label: "ما إعراب كلمة «صافيةٌ»؟",
        options: [
          "مبتدأ",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 1,
        points: 0.5
      }
    ]
  },


  // سؤال من جملتين

  {
    type: "parsing",
    sentence: "المعلمُ المخلصُ محبوبٌ",

    parts: [
      {
        label: "ما إعراب كلمة «المعلمُ»؟",
        options: [
          "مبتدأ مرفوع",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 0,
        points: 0.5
      },

      {
        label: "ما إعراب كلمة «المخلصُ»؟",
        options: [
          "نعت مرفوع",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 0,
        points: 0.5
      }
    ]
  },


  // سؤال من جملتين

  {
    type: "parsing",
    sentence: "البيتُ الكبيرُ جميلٌ",

    parts: [
      {
        label: "ما إعراب كلمة «البيتُ»؟",
        options: [
          "مبتدأ مرفوع",
          "خبر مرفوع",
          "فاعل",
          "مفعول به"
        ],
        correct: 0,
        points: 0.5
      },

      {
        label: "ما إعراب كلمة «جميلٌ»؟",
        options: [
          "خبر مرفوع",
          "مبتدأ",
          "فاعل",
          "مفعول به"
        ],
        correct: 0,
        points: 0.5
      }
    ]
  },


  // ====================================================
  // اختيار بين خيارين
  // ====================================================

  {
    type: "either",
    q: "الجملة الاسمية تبدأ غالبًا بـ:",
    options: ["اسم", "فعل"],
    correct: 0
  },

  {
    type: "either",
    q: "المبتدأ في الأصل يكون:",
    options: ["مرفوعًا", "منصوبًا"],
    correct: 0
  },

  {
    type: "either",
    q: "الخبر في الجملة الاسمية في الأصل يكون:",
    options: ["مرفوعًا", "مجرورًا"],
    correct: 0
  },

  {
    type: "either",
    q: "في «الطالبُ مجتهدٌ» كلمة «الطالبُ» هي:",
    options: ["مبتدأ", "خبر"],
    correct: 0
  },

  {
    type: "either",
    q: "في «السماءُ صافيةٌ» كلمة «صافيةٌ» هي:",
    options: ["خبر", "مبتدأ"],
    correct: 0
  },

  {
    type: "either",
    q: "في «العلمُ مفيدٌ» كلمة «العلمُ» هي:",
    options: ["مبتدأ", "خبر"],
    correct: 0
  },

  {
    type: "either",
    q: "في «الحديقةُ جميلةٌ» كلمة «جميلةٌ» هي:",
    options: ["خبر", "مبتدأ"],
    correct: 0
  },

  {
    type: "either",
    q: "الجملة «كتبَ الطالبُ» هي:",
    options: ["جملة فعلية", "جملة اسمية"],
    correct: 0
  },

  {
    type: "either",
    q: "الجملة «الولدُ نشيطٌ» هي:",
    options: ["جملة اسمية", "جملة فعلية"],
    correct: 0
  },

  {
    type: "either",
    q: "في «الكتابُ جديدٌ» كلمة «جديدٌ» هي:",
    options: ["خبر", "مبتدأ"],
    correct: 0
  }

];


// ======================================================
// إعدادات اللعبة
// ======================================================

let questions = [];
let currentQuestion = 0;
let score = 0;

let playerName = "";

const TOTAL_QUESTIONS = 20;
const PASS_SCORE = 10;


// ======================================================
// عناصر الصفحة
// ======================================================

const startScreen =
  document.getElementById("start-screen");

const quizScreen =
  document.getElementById("quiz-screen");

const endScreen =
  document.getElementById("end-screen");

const questionContainer =
  document.getElementById("question-container");

const scoreSpan =
  document.getElementById("score");

const finalScore =
  document.getElementById("final-score");

const feedbackIcon =
  document.getElementById("feedback-icon");

const bgMusic =
  document.getElementById("bg-music");

const correctSound =
  document.getElementById("correct-sound");

const wrongSound =
  document.getElementById("wrong-sound");

const muteBtn =
  document.getElementById("mute-btn");

const playerNameInput =
  document.getElementById("player-name");

const certificateName =
  document.getElementById("certificate-name");

bgMusic.volume = 0.4;

let isMuted = false;


// ======================================================
// الأزرار
// ======================================================

document
  .getElementById("start-btn")
  .addEventListener(
    "click",
    startGame
  );

document
  .getElementById("restart-btn")
  .addEventListener(
    "click",
    restartGame
  );

muteBtn.addEventListener(
  "click",
  toggleMute
);


// ======================================================
// خلط Array
// ======================================================

function shuffle(array) {

  const arr = [...array];

  for (
    let i = arr.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      arr[i],
      arr[j]
    ] = [
      arr[j],
      arr[i]
    ];

  }

  return arr;
}


// ======================================================
// اختيار 5 من كل نوع
// ======================================================

function getGameQuestions() {

  const mcq =
    questionBank.filter(
      q => q.type === "mcq"
    );

  const reorder =
    questionBank.filter(
      q => q.type === "reorder"
    );

  const parsing =
    questionBank.filter(
      q => q.type === "parsing"
    );

  const either =
    questionBank.filter(
      q => q.type === "either"
    );


  const selected = [

    ...shuffle(mcq).slice(0, 5),

    ...shuffle(reorder).slice(0, 5),

    ...shuffle(parsing).slice(0, 5),

    ...shuffle(either).slice(0, 5)

  ];


  return shuffle(selected);

}


// ======================================================
// بدء اللعبة
// ======================================================

function startGame() {

  const name =
    playerNameInput.value.trim();


  if (name === "") {

    alert(
      "يرجى كتابة الاسم الكامل قبل بدء اللعبة."
    );

    playerNameInput.focus();

    return;
  }


  playerName =
    name;


  currentQuestion = 0;
  score = 0;

  questions =
    getGameQuestions();

  scoreSpan.textContent =
    score;


  switchScreen(
    startScreen,
    quizScreen
  );


  showQuestion();


  bgMusic.currentTime =
    0;

  bgMusic.play().catch(() => {});

}


// ======================================================
// عرض السؤال
// ======================================================

function showQuestion() {

  questionContainer.innerHTML = "";

  feedbackIcon.classList.remove(
    "show"
  );


  const current =
    questions[currentQuestion];


  const number =
    document.createElement("div");


  number.textContent =
    "السؤال " +
    (currentQuestion + 1) +
    " من " +
    TOTAL_QUESTIONS;


  number.style.fontSize =
    "20px";

  number.style.fontWeight =
    "bold";

  number.style.marginBottom =
    "10px";


  questionContainer.appendChild(
    number
  );


  if (current.type === "mcq") {

    renderMCQ(current);

  }

  else if (current.type === "reorder") {

    renderReorder(current);

  }

  else if (current.type === "parsing") {

    renderParsing(current);

  }

  else if (current.type === "either") {

    renderEither(current);

  }

}


// ======================================================
// اختيار من متعدد
// ======================================================

function renderMCQ(q) {

  const title =
    document.createElement("h2");

  title.textContent =
    q.q;

  questionContainer.appendChild(
    title
  );


  const answersBox =
    document.createElement("div");


  q.answers.forEach(
    (answer, index) => {

      const btn =
        document.createElement("button");


      btn.textContent =
        answer;


      btn.addEventListener(
        "click",
        () => {

          checkAnswer(
            index === q.correct,
            answersBox
          );

        }
      );


      answersBox.appendChild(
        btn
      );

    }
  );


  questionContainer.appendChild(
    answersBox
  );

}


// ======================================================
// ترتيب الجملة
// ======================================================

function renderReorder(q) {

  const title =
    document.createElement("h2");

  title.textContent =
    "رتب الكلمات لتكوين جملة اسمية صحيحة:";

  questionContainer.appendChild(
    title
  );


  const buildArea =
    document.createElement("div");

  buildArea.className =
    "build-area";

  questionContainer.appendChild(
    buildArea
  );


  const wordBank =
    document.createElement("div");

  wordBank.className =
    "word-bank";

  questionContainer.appendChild(
    wordBank
  );


  let selectedWords = [];

  const shuffledWords =
    shuffle(q.words);


  function renderWords() {

    wordBank.innerHTML = "";


    shuffledWords.forEach(
      (word, index) => {

        if (
          selectedWords.includes(index)
        ) {

          return;

        }


        const btn =
          document.createElement("button");

        btn.className =
          "word-btn";

        btn.textContent =
          word;


        btn.addEventListener(
          "click",
          () => {

            selectedWords.push(
              index
            );

            renderBuild();

            renderWords();

          }
        );


        wordBank.appendChild(
          btn
        );

      }
    );

  }


  function renderBuild() {

    buildArea.innerHTML = "";


    selectedWords.forEach(
      index => {

        const span =
          document.createElement("span");

        span.className =
          "build-word";

        span.textContent =
          shuffledWords[index];

        buildArea.appendChild(
          span
        );

      }
    );

  }


  renderWords();

  renderBuild();


  const controls =
    document.createElement("div");


  const resetBtn =
    document.createElement("button");

  resetBtn.textContent =
    "إعادة";


  resetBtn.addEventListener(
    "click",
    () => {

      selectedWords = [];

      renderBuild();

      renderWords();

    }
  );


  const checkBtn =
    document.createElement("button");

  checkBtn.textContent =
    "تحقق";


  checkBtn.addEventListener(
    "click",
    () => {

      const userSentence =
        selectedWords.map(
          index =>
            shuffledWords[index]
        );


      const isCorrect =
        JSON.stringify(
          userSentence
        ) ===
        JSON.stringify(
          q.words
        );


      resetBtn.disabled =
        true;

      checkBtn.disabled =
        true;


      wordBank
        .querySelectorAll("button")
        .forEach(
          btn => {

            btn.disabled =
              true;

          }
        );


      checkAnswer(
        isCorrect,
        null
      );


      if (!isCorrect) {

        const correctAnswer =
          document.createElement("p");


        correctAnswer.className =
          "correct-answer-line";


        correctAnswer.textContent =
          "الجملة الصحيحة: " +
          q.words.join(" ");


        questionContainer.appendChild(
          correctAnswer
        );

      }

    }
  );


  controls.appendChild(
    resetBtn
  );

  controls.appendChild(
    checkBtn
  );


  questionContainer.appendChild(
    controls
  );

}


// ======================================================
// الإعراب
// ======================================================

function renderParsing(q) {

  const title =
    document.createElement("h2");

  title.textContent =
    q.sentence;

  title.className =
    "parsing-sentence";


  questionContainer.appendChild(
    title
  );


  let answeredParts = 0;


  q.parts.forEach(
    (part, partIndex) => {

      const partBox =
        document.createElement("div");

      partBox.className =
        "parsing-part";


      const label =
        document.createElement("h3");

      label.textContent =
        part.label;


      partBox.appendChild(
        label
      );


      const optionsBox =
        document.createElement("div");

      optionsBox.className =
        "parsing-options";


      part.options.forEach(
        (option, index) => {

          const btn =
            document.createElement("button");


          btn.textContent =
            option;


          btn.addEventListener(
            "click",
            () => {

              const allButtons =
                optionsBox.querySelectorAll(
                  "button"
                );


              allButtons.forEach(
                button => {

                  button.disabled =
                    true;

                }
              );


              const isCorrect =
                index === part.correct;


              // ======================================
              // العلامة حسب الجزء
              // ======================================

              if (isCorrect) {

                score += part.points;

                scoreSpan.textContent =
                  formatScore(score);

              }


              // ======================================
              // شكل الإجابة
              // ======================================

              if (isCorrect) {

                btn.classList.add(
                  "correct-choice"
                );

              }

              else {

                btn.classList.add(
                  "wrong-choice"
                );


                allButtons[
                  part.correct
                ].classList.add(
                  "correct-choice"
                );

              }


              // ======================================
              // الصوت
              // ======================================

              if (isCorrect) {

                correctSound.currentTime =
                  0;

                correctSound
                  .play()
                  .catch(() => {});

              }

              else {

                wrongSound.currentTime =
                  0;

                wrongSound
                  .play()
                  .catch(() => {});

              }


              // ======================================
              // صورة الصح / الوحش
              // ======================================

              feedbackIcon.src =
                isCorrect
                  ? "images/star.png"
                  : "images/monster.png";


              feedbackIcon.classList.add(
                "show"
              );


              answeredParts++;


              // ======================================
              // انتهاء أجزاء سؤال الإعراب
              // ======================================

              if (
                answeredParts ===
                q.parts.length
              ) {

                setTimeout(
                  () => {

                    currentQuestion++;


                    if (
                      currentQuestion <
                      questions.length
                    ) {

                      showQuestion();

                    }

                    else {

                      endGame();

                    }

                  },
                  900
                );

              }

            }
          );


          optionsBox.appendChild(
            btn
          );

        }
      );


      partBox.appendChild(
        optionsBox
      );


      questionContainer.appendChild(
        partBox
      );

    }
  );

}


// ======================================================
// سؤال خيارين
// ======================================================

function renderEither(q) {

  const title =
    document.createElement("h2");

  title.textContent =
    q.q;


  questionContainer.appendChild(
    title
  );


  const optionsBox =
    document.createElement("div");


  q.options.forEach(
    (option, index) => {

      const btn =
        document.createElement("button");


      btn.textContent =
        option;


      btn.addEventListener(
        "click",
        () => {

          checkAnswer(
            index === q.correct,
            optionsBox
          );

        }
      );


      optionsBox.appendChild(
        btn
      );

    }
  );


  questionContainer.appendChild(
    optionsBox
  );

}


// ======================================================
// فحص الإجابة
// ======================================================

function checkAnswer(
  isCorrect,
  answersBox
) {

  if (answersBox) {

    answersBox
      .querySelectorAll("button")
      .forEach(
        btn => {

          btn.disabled =
            true;

        }
      );

  }


  if (isCorrect) {

    score++;

    scoreSpan.textContent =
      formatScore(score);


    feedbackIcon.src =
      "images/star.png";


    correctSound.currentTime =
      0;

    correctSound
      .play()
      .catch(() => {});

  }

  else {

    feedbackIcon.src =
      "images/monster.png";


    wrongSound.currentTime =
      0;

    wrongSound
      .play()
      .catch(() => {});

  }


  feedbackIcon.classList.add(
    "show"
  );


  setTimeout(
    () => {

      currentQuestion++;


      if (
        currentQuestion <
        questions.length
      ) {

        showQuestion();

      }

      else {

        endGame();

      }

    },
    900
  );

}


// ======================================================
// تنسيق العلامة
// ======================================================

function formatScore(value) {

  return Number.isInteger(value)
    ? value
    : value.toFixed(2).replace(/\.?0+$/, "");

}


// ======================================================
// نهاية اللعبة
// ======================================================

function endGame() {

  switchScreen(
    quizScreen,
    endScreen
  );


  bgMusic.pause();


  finalScore.textContent =
    "نتيجتك: " +
    formatScore(score) +
    " من " +
    TOTAL_QUESTIONS;


  // ======================================
  // اسم الطالب على الشهادة
  // ======================================

  certificateName.textContent =
    playerName;


  // ======================================
  // حذف صورة النهاية القديمة
  // ======================================

  const oldImage =
    document.getElementById(
      "end-result-image"
    );


  if (oldImage) {

    oldImage.remove();

  }


  // ======================================
  // خلفية النهاية
  // ======================================

  const endBackground =
    document.querySelector(
      "#end-screen .bg-img"
    );


  const resultImage =
    document.createElement("img");


  resultImage.id =
    "end-result-image";


  // ======================================
  // نجاح
  // ======================================

  if (
    score >= PASS_SCORE
  ) {

    endBackground.src =
      "images/ending_bg.png";


    resultImage.src =
      "images/success.png";


    finalScore.textContent +=
      " 🎉 أحسنت! لقد نجحت!";

  }

  // ======================================
  // رسوب
  // ======================================

  else {

    endBackground.src =
      "images/fail_bg.png";


    resultImage.src =
      "images/fail.png";


    finalScore.textContent +=
      " 😔 حاول مرة أخرى!";

  }


  resultImage.style.width =
    "220px";

  resultImage.style.maxWidth =
    "60%";

  resultImage.style.display =
    "block";

  resultImage.style.margin =
    "15px auto";


  const overlay =
    document.querySelector(
      "#end-screen .overlay"
    );


  overlay.insertBefore(
    resultImage,
    finalScore
  );

}


// ======================================================
// إعادة اللعبة
// ======================================================

function restartGame() {

  switchScreen(
    endScreen,
    startScreen
  );


  bgMusic.pause();

  bgMusic.currentTime =
    0;


  feedbackIcon.classList.remove(
    "show"
  );


  // إعادة خلفية النهاية الافتراضية

  const endBackground =
    document.querySelector(
      "#end-screen .bg-img"
    );


  endBackground.src =
    "images/ending_bg.png";


  // إزالة صورة النجاح/الرسوب القديمة

  const oldImage =
    document.getElementById(
      "end-result-image"
    );


  if (oldImage) {

    oldImage.remove();

  }


  // تنظيف الاسم

  playerNameInput.value =
    "";

  playerName =
    "";

}


// ======================================================
// تبديل الشاشات
// ======================================================

function switchScreen(
  hide,
  show
) {

  hide.classList.remove(
    "active"
  );

  show.classList.add(
    "active"
  );

}


// ======================================================
// كتم الأصوات
// ======================================================

function toggleMute() {

  isMuted =
    !isMuted;


  bgMusic.muted =
    isMuted;

  correctSound.muted =
    isMuted;

  wrongSound.muted =
    isMuted;


  muteBtn.textContent =
    isMuted
      ? "🔇"
      : "🔊";

}function testSuccess() {
  playerName = "محمد أحمد";
  score = 15;
  startScreen.classList.remove("active");
  quizScreen.classList.remove("active");
  endGame();
}
