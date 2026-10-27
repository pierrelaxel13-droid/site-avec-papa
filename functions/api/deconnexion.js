/* GET /api/deconnexion : efface la session et revient à l'accueil. */
import { redirige, cookiesEffaces } from "../../serveur/compte.mjs";

export const onRequestGet = () => redirige("/", cookiesEffaces);
