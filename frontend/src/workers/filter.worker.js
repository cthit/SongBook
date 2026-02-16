import fuzzysort from "fuzzysort";

/* eslint-disable-next-line no-restricted-globals */
self.onmessage = function({ data: { songs, filterText, filterTags } }) {
    let filteredSongs = songs;

    if (filterTags.length) {
        filteredSongs = songs.filter(song =>
            song.tags.some(tag => filterTags.includes(tag))
        );
    }

    if (filterText !== "") {
        filteredSongs = filteredSongs.map(s => ({
            ...s,
            number: "" + s.number
        }));

        const res = fuzzysort.go(filterText, filteredSongs, {
            keys: ["number", "title", "melody", "author", "text"],
            allowTypo: false,
            threshold: -500
        });

        filteredSongs = res.map(r => r.obj);
    }

    postMessage(filteredSongs);
};
