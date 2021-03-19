import React from "react";
import {
    DigitButton,
    DigitDesign,
    DigitText,
    useDigitTranslations
} from "@cthit/react-digit-components";

const FiveZeroZero = () => {
    const [text] = useDigitTranslations();

    return (
        <DigitDesign.Card margin={"auto"} size={{ width: "300px" }}>
            <DigitDesign.CardHeader>
                <DigitDesign.CardTitle text={text.SomethingWentWrong} />
            </DigitDesign.CardHeader>
            <DigitDesign.CardHeaderImage src="/images/500.gif" />
            <DigitDesign.CardBody>
                <DigitText.Text text={text.Contact} />
            </DigitDesign.CardBody>
            <DigitDesign.CardButtons>
                <DigitButton
                    outlined
                    text={text.RefreshWebsite}
                    onClick={() => {
                        document.location.href = "/";
                    }}
                />
            </DigitDesign.CardButtons>
        </DigitDesign.Card>
    );
};

export default FiveZeroZero;
