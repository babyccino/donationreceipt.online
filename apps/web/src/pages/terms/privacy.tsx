import { ReactNode } from "react"

import { H1, H3, InterpretationDefinitions, P, Q, Ul, email } from "@/components/agreements"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "components/dist/ui/accordion"

const H4 = ({ children }: { children: ReactNode }) => (
  <h4 className="mb-2 inline-block text-lg font-medium tracking-tight text-gray-900 dark:text-gray-400">
    {children}
  </h4>
)
const P2 = ({ children }: { children: ReactNode }) => (
  <p className="sm:text-md mb-2 text-gray-500 dark:text-gray-400">{children}</p>
)
const Purposes = () => (
  <ul className="mb-6 ml-4 list-outside list-disc space-y-2 text-gray-500 dark:text-gray-400">
    <li className="pl-2">
      <H4>
        <strong>Necessary / Essential Cookies</strong>
      </H4>
      <P2>
        <strong>Type:</strong> Session Cookies
      </P2>
      <P2>
        <strong>Administered by:</strong> Us
      </P2>
      <P2>
        <strong>Purpose:</strong> These Cookies are essential to provide You with services available
        through the Website and to enable You to use some of its features. They help to authenticate
        users and prevent fraudulent use of user accounts. Without these Cookies, the services that
        You have asked for cannot be provided, and We only use these Cookies to provide You with
        those services.
      </P2>
    </li>
    <li className="pl-2">
      <H4>
        <strong>Cookies Policy / Notice Acceptance Cookies</strong>
      </H4>
      <P2>
        <strong>Type:</strong> Persistent Cookies
      </P2>
      <P2>
        <strong>Administered by:</strong> Us
      </P2>
      <P2>
        <strong>Purpose:</strong> These Cookies identify if users have accepted the use of cookies
        on the Website.
      </P2>
    </li>
    <li className="pl-2">
      <H4>
        <strong>Functionality Cookies</strong>
      </H4>
      <P2>
        <strong>Type:</strong> Persistent Cookies
      </P2>
      <P2>
        <strong>Administered by:</strong> Us
      </P2>
      <P2>
        <strong>Purpose:</strong> These Cookies allow us to remember choices You make when You use
        the Website, such as remembering your login details or language preference. The purpose of
        these Cookies is to provide You with a more personal experience and to avoid You having to
        re-enter your preferences every time You use the Website.
      </P2>
    </li>
  </ul>
)

const PersonalData = () => (
  <Accordion type="multiple" className="ml-4">
    <AccordionItem value="types of data collected">
      <AccordionTrigger>Types of Data Collected</AccordionTrigger>
      <AccordionContent>
        <H3>Personal Data</H3>
        <P>
          While using Our Service, We may ask You to provide Us with certain personally identifiable
          information that can be used to contact or identify You. Personally identifiable
          information may include, but is not limited to:
        </P>
        <Ul>
          <li>Email address</li>
          <li>First name and last name</li>
          <li>Phone number</li>
          <li>Address, State, Province, ZIP/Postal code, City</li>
          <li>Your signature</li>
          {/* <li>Usage Data</li> */}
        </Ul>
        <H3>Information About Your Organisation</H3>
        <P>
          While using Our Service, We may ask You to provide Us with certain information about your
          company:
        </P>
        <Ul>
          <li>Charitable registration number</li>
          <li>Your organisation{"'"}s logo</li>
          <li>Your organisation{"'"}s Address, State, Province, ZIP/Postal code, City</li>
          {/* <li>Usage Data</li> */}
        </Ul>
        {/* <H3>Usage Data</H3>
            <P>Usage Data is collected automatically when using the Service.</P>
            <P>
              Usage Data may include information such as Your Device{"'"}s Internet Protocol address (e.g.
              IP address), browser type, browser version, the pages of our Service that You visit, the time
              and date of Your visit, the time spent on those pages, unique device identifiers and other
              diagnostic data.
            </P>
            <P>
              When You access the Service by or through a mobile device, We may collect certain information
              automatically, including, but not limited to, the type of mobile device You use, Your mobile
              device unique ID, the IP address of Your mobile device, Your mobile operating system, the type
              of mobile Internet browser You use, unique device identifiers and other diagnostic data.
            </P>
            <P>
              We may also collect information that Your browser sends whenever You visit our Service or when
              You access the Service by or through a mobile device.
            </P> */}
        <P>
          Cookies can be <Q>Persistent</Q> or <Q>Session</Q> Cookies. Persistent Cookies remain on
          Your personal computer or mobile device when You go offline, while Session Cookies are
          deleted as soon as You close Your web browser. You can learn more about cookies on{" "}
          <a href="https://www.termsfeed.com/blog/cookies/#What_Are_Cookies" target="_blank">
            TermsFeed website
          </a>{" "}
          article.
        </P>
        <P>We use Persistent Cookies for the purposes set out below:</P>
        <Purposes />
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="Use of Your Personal Data">
      <AccordionTrigger>Use of Your Personal Data</AccordionTrigger>
      <AccordionContent>
        <P>The Company may use Personal Data for the following purposes:</P>
        <Ul>
          <li>
            <strong>To provide and maintain our Service</strong>, including to monitor the usage of
            our Service.
          </li>
          <li>
            <strong>To manage Your Account:</strong> to manage Your registration as a user of the
            Service. The Personal Data You provide can give You access to different functionalities
            of the Service that are available to You as a registered user.
          </li>
          <li>
            <strong>For the performance of a contract:</strong> the development, compliance and
            undertaking of the purchase contract for the products, items or services You have
            purchased or of any other contract with Us through the Service.
          </li>
          <li>
            <strong>To contact You:</strong> To contact You by email, telephone calls, SMS, or other
            equivalent forms of electronic communication, such as a mobile application{"'"}s push
            notifications regarding updates or informative communications related to the
            functionalities, products or contracted services, including the security updates, when
            necessary or reasonable for their implementation.
          </li>
          <li>
            <strong>To manage Your requests:</strong> To attend and manage Your requests to Us.
          </li>
          <li>
            <strong>For business transfers:</strong> We may use Your information to evaluate or
            conduct a merger, divestiture, restructuring, reorganization, dissolution, or other sale
            or transfer of some or all of Our assets, whether as a going concern or as part of
            bankruptcy, liquidation, or similar proceeding, in which Personal Data held by Us about
            our Service users is among the assets transferred.
          </li>
          <li>
            <strong>For other purposes</strong>: We may use Your information for other purposes,
            such as data analysis, identifying usage trends, determining the effectiveness of our
            promotional campaigns and to evaluate and improve our Service, products, services,
            marketing and your experience.
          </li>
        </Ul>
        <P>We may share Your personal information in the following situations:</P>
        <Ul>
          <li>
            <strong>With Service Providers:</strong> We may share Your personal information with
            Service Providers to monitor and analyze the use of our Service, to contact You.
          </li>
          <li>
            <strong>For business transfers:</strong> We may share or transfer Your personal
            information in connection with, or during negotiations of, any merger, sale of Company
            assets, financing, or acquisition of all or a portion of Our business to another
            company.
          </li>
          <li>
            <strong>With Affiliates:</strong> We may share Your information with Our affiliates, in
            which case we will require those affiliates to honor this Privacy Policy. Affiliates
            include Our parent company and any other subsidiaries, joint venture partners or other
            companies that We control or that are under common control with Us.
          </li>
          <li>
            <strong>With business partners:</strong> We may share Your information with Our business
            partners to offer You certain products, services or promotions.
          </li>
          <li>
            <strong>With other users:</strong> when You share personal information or otherwise
            interact in the public areas with other users, such information may be viewed by all
            users and may be publicly distributed outside.
          </li>
          <li>
            <strong>With Your consent</strong>: We may disclose Your personal information for any
            other purpose with Your consent.
          </li>
        </Ul>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="Retention of Your Personal Data">
      <AccordionTrigger>Retention of Your Personal Data</AccordionTrigger>
      <AccordionContent>
        <P>
          The Company will retain Your Personal Data only for as long as is necessary for the
          purposes set out in this Privacy Policy. We will retain and use Your Personal Data to the
          extent necessary to comply with our legal obligations (for example, if we are required to
          retain your data to comply with applicable laws), resolve disputes, and enforce our legal
          agreements and policies.
        </P>
        <P>
          The Company will also retain Usage Data for internal analysis purposes. Usage Data is
          generally retained for a shorter period of time, except when this data is used to
          strengthen the security or to improve the functionality of Our Service, or We are legally
          obligated to retain this data for longer time periods.
        </P>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="Transfer of Your Personal Data">
      <AccordionTrigger>Transfer of Your Personal Data</AccordionTrigger>
      <AccordionContent>
        <P>
          Your information, including Personal Data, is processed at the Company{"'"}s operating
          offices and in any other places where the parties involved in the processing are located.
          It means that this information may be transferred to — and maintained on — computers
          located outside of Your state, province, country or other governmental jurisdiction where
          the data protection laws may differ than those from Your jurisdiction.
        </P>
        <P>
          Your consent to this Privacy Policy followed by Your submission of such information
          represents Your agreement to that transfer.
        </P>
        <P>
          The Company will take all steps reasonably necessary to ensure that Your data is treated
          securely and in accordance with this Privacy Policy and no transfer of Your Personal Data
          will take place to an organization or a country unless there are adequate controls in
          place including the security of Your data and other personal information.
        </P>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="Delete Your Personal Data">
      <AccordionTrigger>Delete Your Personal Data</AccordionTrigger>
      <AccordionContent>
        <P>
          You have the right to delete or request that We assist in deleting the Personal Data that
          We have collected about You.
        </P>
        <P>
          Our Service may give You the ability to delete certain information about You from within
          the Service.
        </P>
        <P>
          You may update, amend, or delete Your information at any time by signing in to Your
          Account, if you have one, and visiting the account settings section that allows you to
          manage Your personal information. You may also contact Us to request access to, correct,
          or delete any personal information that You have provided to Us.
        </P>
        <P>
          Please note, however, that We may need to retain certain information when we have a legal
          obligation or lawful basis to do so.
        </P>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="Disclosure of Your Personal Data">
      <AccordionTrigger>Disclosure of Your Personal Data</AccordionTrigger>
      <AccordionContent>
        <H3>Business Transactions</H3>
        <P>
          If the Company is involved in a merger, acquisition or asset sale, Your Personal Data may
          be transferred. We will provide notice before Your Personal Data is transferred and
          becomes subject to a different Privacy Policy.
        </P>
        <H3>Law enforcement</H3>
        <P>
          Under certain circumstances, the Company may be required to disclose Your Personal Data if
          required to do so by law or in response to valid requests by public authorities (e.g. a
          court or a government agency).
        </P>
        <H3>Other legal requirements</H3>
        <P>
          The Company may disclose Your Personal Data in the good faith belief that such action is
          necessary to:
        </P>
        <Ul>
          <li>Comply with a legal obligation</li>
          <li>Protect and defend the rights or property of the Company</li>
          <li>Prevent or investigate possible wrongdoing in connection with the Service</li>
          <li>Protect the personal safety of Users of the Service or the public</li>
          <li>Protect against legal liability</li>
        </Ul>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="Security of Your Personal Data">
      <AccordionTrigger>Security of Your Personal Data</AccordionTrigger>
      <AccordionContent>
        <P>
          The security of Your Personal Data is important to Us, but remember that no method of
          transmission over the Internet, or method of electronic storage is 100% secure. While We
          strive to use commercially acceptable means to protect Your Personal Data, We cannot
          guarantee its absolute security.
        </P>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
)

const Privacy = () => (
  <section className="m-8 max-w-4xl">
    <H1>Privacy Policy</H1>
    <P>Last updated: June 7th, 2023</P>
    <P>
      This Privacy Policy describes Our policies and procedures on the collection, use and
      disclosure of Your information when You use the Service and tells You about Your privacy
      rights and how the law protects You.
    </P>
    <P>
      We use Your Personal data to provide and improve the Service. By using the Service, You agree
      to the collection and use of information in accordance with this Privacy Policy. This Privacy
      Policy has been created with the help of the{" "}
      <a href="https://www.termsfeed.com/privacy-policy-generator/" target="_blank">
        TermsFeed Privacy Policy Generator.
      </a>
    </P>
    <Accordion type="multiple">
      {InterpretationDefinitions}
      <AccordionItem value="Collecting and Using Your Personal Data">
        <AccordionTrigger>Collecting and Using Your Personal Data</AccordionTrigger>
        <AccordionContent>
          <PersonalData />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Children's Privacy">
        <AccordionTrigger>Children{"'"}s Privacy</AccordionTrigger>
        <AccordionContent>
          <P>
            Our Service does not address anyone under the age of 13. We do not knowingly collect
            personally identifiable information from anyone under the age of 13. If You are a parent
            or guardian and You are aware that Your child has provided Us with Personal Data, please
            contact Us. If We become aware that We have collected Personal Data from anyone under
            the age of 13 without verification of parental consent, We take steps to remove that
            information from Our servers.
          </P>
          <P>
            If We need to rely on consent as a legal basis for processing Your information and Your
            country requires consent from a parent, We may require Your parent{"'"}s consent before
            We collect and use that information.
          </P>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Links to Other Websites">
        <AccordionTrigger>Links to Other Websites</AccordionTrigger>
        <AccordionContent>
          <P>
            Our Service may contain links to other websites that are not operated by Us. If You
            click on a third party link, You will be directed to that third party{"'"}s site. We
            strongly advise You to review the Privacy Policy of every site You visit.
          </P>
          <P>
            We have no control over and assume no responsibility for the content, privacy policies
            or practices of any third party sites or services.
          </P>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Changes to this Privacy Policy">
        <AccordionTrigger>Changes to this Privacy Policy</AccordionTrigger>
        <AccordionContent>
          <P>
            We may update Our Privacy Policy from time to time. We will notify You of any changes by
            posting the new Privacy Policy on this page.
          </P>
          <P>
            We will let You know via email and/or a prominent notice on Our Service, prior to the
            change becoming effective and update the <Q>Last updated</Q> date at the top of this
            Privacy Policy.
          </P>
          <P>
            You are advised to review this Privacy Policy periodically for any changes. Changes to
            this Privacy Policy are effective when they are posted on this page.
          </P>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Contact Us">
        <AccordionTrigger>Contact Us</AccordionTrigger>
        <AccordionContent>
          <P>If you have any questions about this Privacy Policy, You can contact us:</P>
          <Ul>
            <li>By email: {email}</li>
          </Ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </section>
)
export default Privacy

// --- server-side props ---

export { defaultGetServerSideProps as getServerSideProps } from "@/lib/util/get-server-side-props"
