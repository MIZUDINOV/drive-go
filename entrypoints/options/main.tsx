import { render } from "solid-js/web";
import { OptionsApp } from "./OptionsApp";
import "material-symbols/rounded.css";
import "./options.css";

const root = document.getElementById("root");

if (root) {
  render(() => <OptionsApp />, root);
}
