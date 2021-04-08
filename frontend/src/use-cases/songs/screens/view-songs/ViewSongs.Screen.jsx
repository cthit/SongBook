import useAdmin from "../../../../common/hooks/use-admin";
import { useHistory, useParams } from "react-router-dom";
import React, { useEffect, useState } from "react";
import {
    useDigitCustomDialog,
    useDigitTranslations,
    DigitLayout
} from "@cthit/react-digit-components";
import SongDetails from "./components/song-detail/SongDetail.dialog";
import SearchBar from "./components/search-bar/Searchbar.component";
import FourZeroFour from "../../../../common/components/four-zero-four";
import SongMasonry from "./components/song-masonry";
import FiveZeroZeroComponent from "../../../../common/components/five-zero-zero";
import { useSongs } from "../../../../app/Songs.context";
import { NoSongs } from "./components/no-songs/NoSongs.component";
import CenterLoading from "../../../../common/components/center-loading";

const ViewSongs = () => {
    const history = useHistory();
    const [text, lang] = useDigitTranslations();

    const [filterText, setFilterText] = useState("");
    const [filterTags, setFilterTags] = useState([]);

    const { songs, tags, getSong, loading, refetching, error } = useSongs();

    const { song_id } = useParams();
    const [openDialog] = useDigitCustomDialog();
    const [faultySongId, setFaultySongId] = useState(false);
    const [somethingWrong, setSomethingWrong] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const admin = useAdmin();

    useEffect(() => {
        if (!loading) {
            if (song_id) {
                const song = getSong(song_id);
                if (song) {
                    openDialog(SongDetails(admin, song, history, text, lang));
                } else {
                    if (error) {
                        setSomethingWrong(true);
                    } else {
                        setFaultySongId(true);
                    }
                }
            } else {
                setFaultySongId(false);
            }
        }
    }, [loading, song_id, text, admin, getSong, openDialog, history, error]);

    const [filteredSongs, setFilteredSongs] = useState(songs);
    const [timeoutVal, setTimeoutVal] = useState(0);
    useEffect(() => {
        setIsFiltering(true);
        const filterWorker = new Worker("/workers/filter.worker.js");
        filterWorker.onmessage = e => {
            setFilteredSongs(e.data);
            setTimeoutVal(timeoutVal + 1);
            const val = timeoutVal;
            setTimeout(() => {
                if (timeoutVal === val) {
                    setTimeoutVal(0);
                    setIsFiltering(false);
                }
            }, 300);
        };
        filterWorker.postMessage({ songs, filterText, filterTags });
        return () => {
            filterWorker.terminate();
        };
    }, [filterTags, filterText, songs]);

    if (faultySongId) {
        return <FourZeroFour />;
    }

    if (somethingWrong) {
        return <FiveZeroZeroComponent />;
    }

    return (
        <DigitLayout.Column flex={"1"}>
            <SearchBar
                filterTextState={{ filterText, setFilterText }}
                filterTagsState={{ filterTags, setFilterTags }}
            />
            <CenterLoading loading={refetching || loading} />
            {!isFiltering && filteredSongs.length === 0 && (
                <NoSongs
                    resetFilters={() => {
                        setFilterTags([]);
                        setFilterText("");
                    }}
                />
            )}
            <SongMasonry songs={isFiltering ? [] : filteredSongs} tags={tags} />
        </DigitLayout.Column>
    );
};

export default ViewSongs;
