import {
    DigitChip,
    DigitDesign,
    DigitMarkdown,
    DigitText,
    DigitLayout
} from "@cthit/react-digit-components";
import { BASE_ROUTE } from "../../../../../../../app/App.routes";
import { digITSong } from "../../../ViewSongs.Screen";
import React from "react";
import styled from "styled-components";

export const TagList = styled.div`
    margin-top: auto;
    flex-direction: row;
`;

const findTags = (tagIds, tags) => {
    return tagIds.map(id => tags.find(tag => tag.tag_id === id));
};

const startOfText = text => {
    const start = text.slice(0, 100);
    const [restOfLine] = text.slice(100).split("\n", 1);
    return start.concat(restOfLine, "\n\n...");
};

const SongPreview = ({ song, history, text, tags }) => {
    const melody = song.melody ? song.melody : text.Unknown;
    const author = song.author ? song.author : text.Unknown;

    return (
        <DigitDesign.Link
            to={BASE_ROUTE + song.song_id}
            style={{ textDecoration: "none" }}
        >
            <DigitDesign.Card
                className={song.song_id === digITSong.song_id ? "digit-song-preview" : null}
            >
                <DigitDesign.CardBody>
                    <DigitLayout.Column>
                        <DigitText.Title
                            text={song.number + ". " + song.title}
                        />
                        <DigitText.Text
                            bold
                            text={text.Author + ": " + author}
                        />
                        <DigitText.Text text={"Mel: " + melody} />
                        <DigitMarkdown
                            markdownSource={startOfText(song.text)}
                        />
                        <TagList>
                            {findTags(song.tags, tags).map(tag => (
                                <DigitChip
                                    primary
                                    key={tag.tag_id}
                                    label={tag.name}
                                />
                            ))}
                        </TagList>
                    </DigitLayout.Column>
                </DigitDesign.CardBody>
            </DigitDesign.Card>
        </DigitDesign.Link>
    );
};

export default SongPreview;
