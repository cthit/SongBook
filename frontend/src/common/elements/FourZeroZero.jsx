import React from "react";
import {
    useDigitTranslations,
    DigitDesign,
    DigitText,
    DigitButton
} from "@cthit/react-digit-components";
import { useHistory } from "react-router-dom";
import { navHome } from "../../app/App.Routes";

const FourZeroFour = () => {
    const [text] = useDigitTranslations();
    const history = useHistory();

    return (
        <DigitDesign.Card margin={"auto"} size={{ width: "300px" }}>
            <DigitDesign.CardHeader>
                <DigitDesign.CardTitle text={text.PageNotFound} />
            </DigitDesign.CardHeader>
            <DigitDesign.CardHeaderImage src="/images/404.jpg" />
            <DigitDesign.CardBody>
                <DigitText.Text
                    text={
                        "This is not the site you're looking for! \n" +
                        text.ContactDigit
                    }
                />
            </DigitDesign.CardBody>
            <DigitDesign.CardButtons>
                <DigitButton
                    onClick={() => navHome(history)}
                    outlined
                    text={text.Back}
                />
            </DigitDesign.CardButtons>
        </DigitDesign.Card>
    );
};

export default FourZeroFour;
