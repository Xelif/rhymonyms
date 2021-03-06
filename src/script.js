(function() {

  "use strict";

  const synonymInput = document.getElementById("synonymInput");
  const rhymeInput = document.getElementById("rhymeInput");
  const submitButton = document.getElementById("submit");
  const matches = {
    perfect: {
      synonym: document.getElementById("perfectSynonymMatches"),
      antonym: document.getElementById("perfectAntonymMatches")
    },
    partial: {
      synonym: document.getElementById("partialSynonymMatches"),
      antonym: document.getElementById("partialAntonymMatches")
    }
  }

  // super unsafe!
  // to make it safe we'd have to build a simple backend
  // to proxy our request to the BigHugeLabs thesaurus API
  // (no credit card is required to use their free tier so harm is limited)
  const BHL_API_KEY = "06a3f8e208a7b89744617022241cbd06";

  function clearMatchesList() {
    for(let rhymeType in matches) {
      for(let wordType in matches[rhymeType]) {
        while(matches[rhymeType][wordType].hasChildNodes()) {
          matches[rhymeType][wordType].removeChild(
            matches[rhymeType][wordType].lastChild
          );
        }
      }
    }
  }

  function fetchSynonyms(word) {
    return Promise.resolve(
      fetch(`https://words.bighugelabs.com/api/2/${BHL_API_KEY}/${word}/json`)
       .then(response => {
         if(response.ok) {
           return response.json();
         } else if (response.status === 303) { // alternate word, per API documentation
           return fetch(`https://words.bighugelabs.com/api/2/${BHL_API_KEY}/${response.statusText}`)
                   .then(response => response.json());
         } else {
           throw `Could not access thesaurus. Reason: ${response.statusText}`;
         }
       })
       .then(result => {
         let synonymList = [{word, isSynonym: true}]; // words mean the same thing as themselves!
         for(let partOfSpeech in result) {
           // ignore part of speech, we want all synonyms
           synonymList = synonymList.concat(result[partOfSpeech].syn
                                      .map(word => { return { word, isSynonym: true}})
                                    )
          if(result[partOfSpeech].usr) {
            synonymList = synonymList.concat(result[partOfSpeech].usr
                                      .map(word => { return { word, isSynonym: true}})
                                    );
          }
          if(result[partOfSpeech].ant) {
            synonymList = synonymList.concat(result[partOfSpeech].ant
                                       .map(word => { return { word, isSynonym: false}})
                                     )
          }
                                    
         }
         return synonymList;
       })
    )
  }

  function fetchRhymes(word) {
    return Promise.resolve(
      // RhymeBrain API does not support HTTPS (wtf it's 2017 folks)
      // CORS-anywhere proxies cross-origin requests to unsecure resources
      // CORS-anywhere source: https://github.com/Rob--W/cors-anywhere/
      fetch(`https://cors-anywhere.herokuapp.com/http://rhymebrain.com/talk?function=getRhymes&word=${word}`)
       .then(response => {
         if(response.ok) {
           return response.json();
         } else {
           throw `Could not access rhyming dictionary. Reason: ${response.statusText}`;
         }
       })
       .then(results => {
         return results.map(result => { return {word: result.word, isPerfect: result.score === 300} })
                       .concat({word, isPerfect: true}); // words rhyme with themselves!
       })
    )
  }

  function findWordsInCommon(synonymList, rhymeList) {

    // synonyms may be phrases, but rhymes are not
    // extract the last word of each synonym or antonym
    const synonymLastWords = synonymList.map(synonym => /\S+$/.exec(synonym.word)[0]);

    const synonymSet = new Set(synonymLastWords);
    const rhymeSet = new Set(rhymeList.map(rhyme => rhyme.word));
    
    // intersect the sets
    const wordsInCommonSet = new Set();
    for(let word of synonymSet) {
      if(rhymeSet.has(word)) {
        wordsInCommonSet.add(word);
      }
    }

    // go back and make sure we include all
    // the matching synonyms, including phrases
    // then add perfect/partial rhyme info
    // then remove duplicates
    return synonymList.filter(synonym => wordsInCommonSet.has(/\S+$/.exec(synonym.word)[0]))
                      .map(synonym => {
                        return {
                          isPerfect: rhymeList.find(
                            rhyme => rhyme.word === /\S+$/.exec(synonym.word)[0]
                          ).isPerfect,
                          ...synonym
                        }
                      })
                      .reduce((accum, current) => {
                        if(accum.some(syn => syn.word === current.word)) {
                          return accum;
                        } else {
                          accum.push(current);
                          return accum;
                        }
                      }, []);
  }

  const foundSynonymsDiv = document.querySelector(".synonyms .found");
  const notFoundSynonymsDiv = document.querySelector(".synonyms .not-found");
  const foundAntonymsDiv = document.querySelector(".antonyms .found");
  const notFoundAntonymsDiv = document.querySelector(".antonyms .not-found");
  const noneFoundDiv = document.querySelector(".none-found");
  const synonymsDiv = document.querySelector(".synonyms");
  const antonymsDiv = document.querySelector(".antonyms");

  const createListItemWithText = (text) => {
    const li = document.createElement("li");
    li.appendChild(document.createTextNode(text));
    return li;
  }

  function populateMatchesList(words) {
    if(words.length < 1) {
      noneFoundDiv.classList.remove("is-hidden");
      synonymsDiv.classList.add("is-hidden");
      antonymsDiv.classList.add("is-hidden");
      return;
    } else {
      noneFoundDiv.classList.add("is-hidden");
      synonymsDiv.classList.remove("is-hidden");
      antonymsDiv.classList.remove("is-hidden");
    }
    const foundSynonyms = [false, false]; // perfect, partial
    const foundAntonyms = [false, false]; // perfect, partial
    words.forEach(word => {
      const wordListItem = createListItemWithText(word.word);
      if(word.isPerfect) {
        if(word.isSynonym) {
          matches.perfect.synonym.appendChild(wordListItem);
          foundSynonyms[0] = true;
        } else {
          matches.perfect.antonym.appendChild(wordListItem);
          foundAntonyms[0] = true;
        }
      } else {
        if(word.isSynonym) {
          matches.partial.synonym.appendChild(wordListItem);
          foundSynonyms[1] = true;
        } else {
          matches.partial.antonym.appendChild(wordListItem);
          foundAntonyms[1] = true;
        }
      }
    });

    if(!(foundSynonyms[0] || foundSynonyms[1])) {
      foundSynonymsDiv.classList.add("is-hidden");
      notFoundSynonymsDiv.classList.remove("is-hidden");
    } else {
      foundSynonymsDiv.classList.remove("is-hidden");
      notFoundSynonymsDiv.classList.add("is-hidden");
      if(!foundSynonyms[0]) {
        matches.perfect.synonym.appendChild(createListItemWithText("(none)"));
      } else {
        matches.partial.synonym.appendChild(createListItemWithText("(none)"));
      }
    }
    if(!(foundAntonyms[0] || foundAntonyms[1])) {
      foundAntonymsDiv.classList.add("is-hidden");
      notFoundAntonymsDiv.classList.remove("is-hidden");``
    } else {
      foundAntonymsDiv.classList.remove("is-hidden");
      notFoundAntonymsDiv.classList.add("is-hidden");
      if(!foundAntonyms[0]) {
        matches.perfect.antonym.appendChild(createListItemWithText("(none)"));
      } else {
        matches.partial.antonym.appendChild(createListItemWithText("(none)"));
      }
    }

  }


  // validation: must contain exactly one word, no whitespace
  const isValid = (text) => /^\S*$/.test(text);

  const resultsDiv = document.querySelector(".results");
  const messageDiv = document.querySelector(".message");
  const loadingDiv = document.querySelector(".loading");
  const messageText = document.getElementById("messageText");

  function handleSubmit(evt) {
    // clean up prior results
    resultsDiv.classList.add("is-hidden");
    clearMatchesList();

    // clear any prior errors
    synonymInput.classList.remove("is-error");
    rhymeInput.classList.remove("is-error");

    // if input is valid, go find rhymonyms
    const synonymText = synonymInput.value.trim();
    const rhymeText = rhymeInput.value.trim();
    if(isValid(synonymText) && isValid(rhymeText)) {
      messageDiv.classList.add("is-hidden");
      loadingDiv.classList.remove("is-hidden");
      Promise.all([fetchSynonyms(synonymText), fetchRhymes(rhymeText)])
            .then(([synonyms, rhymes]) => findWordsInCommon(synonyms, rhymes))
            .then(wordsInCommon => populateMatchesList(wordsInCommon))
            .then(() => {
              loadingDiv.classList.add("is-hidden");
              resultsDiv.classList.remove("is-hidden");
            })
            .catch(reason => {
              messageText.textContent = reason;
              loadingDiv.classList.add("is-hidden");
              resultsDiv.classList.add("is-hidden");
              messageDiv.classList.remove("is-hidden");
            });
    } else {
      messageText.textContent = "Please enter only one word in each box."
      messageDiv.classList.remove("is-hidden");
      if(!isValid(synonymText)) {
        synonymInput.classList.add("is-error");
      }
      if(!isValid(rhymeText)) {
        rhymeInput.classList.add("is-error");
      }
    }
  }

  submitButton.addEventListener("click", handleSubmit);

})()