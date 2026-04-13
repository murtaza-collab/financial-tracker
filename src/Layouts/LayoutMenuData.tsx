import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Navdata = () => {
    const history = useNavigate();

    const [isLoans, setIsLoans] = useState(false);
    const [iscurrentState, setIscurrentState] = useState('Dashboard');

    useEffect(() => {
    if (iscurrentState !== 'Loans') setIsLoans(false);
}, [iscurrentState]);

    const menuItems: any = [
        {
            label: "Main",
            isHeader: true,
        },
        {
            id: "dashboard",
            label: "Dashboard",
            icon: "bx bxs-dashboard",
            link: "/dashboard",
            click: function (e: any) {
                e.preventDefault();
                history("/dashboard");
                setIscurrentState('Dashboard');
            },
        },
        {
            id: "accounts",
            label: "Accounts & Cards",
            icon: "bx bx-wallet",
            link: "/accounts",
            click: function (e: any) {
                e.preventDefault();
                history("/accounts");
                setIscurrentState('Accounts');
            },
        },
        {
            id: "transactions",
            label: "Transactions",
            icon: "bx bx-transfer",
            link: "/transactions",
            click: function (e: any) {
                e.preventDefault();
                history("/transactions");
                setIscurrentState('Transactions');
            },
        },
        {
            label: "Track",
            isHeader: true,
        },
        {
            id: "credit-cards",
            label: "Credit Card Bills",
            icon: "bx bx-credit-card",
            link: "/credit-cards",
            click: function (e: any) {
                e.preventDefault();
                history("/credit-cards");
                setIscurrentState('CreditCards');
            },
        },
        {
            id: "splits",
            label: "Splits & Recoveries",
            icon: "bx bx-group",
            link: "/splits",
            click: function (e: any) {
                e.preventDefault();
                history("/splits");
                setIscurrentState('Splits');
            },
        },
        {
            id: "loans",
            label: "Loans",
            icon: "bx bx-money",
            link: "/#",
            stateVariables: isLoans,
            click: function (e: any) {
                e.preventDefault();
                setIsLoans(!isLoans);
                setIscurrentState('Loans');
            },
            subItems: [
                { id: "loans-given", label: "Money to Receive", link: "/loans-given", parentId: "loans" },
                { id: "loans-taken", label: "Money to Pay Back", link: "/loans-taken", parentId: "loans" },
            ],
        },
        {
            id: "emis",
            label: "EMI Tracker",
            icon: "bx bx-calendar-check",
            link: "/emis",
            click: function (e: any) {
                e.preventDefault();
                history("/emis");
                setIscurrentState('EMIs');
            },
        },
        {
            id: "goals",
            label: "Savings Goals",
            icon: "bx bx-target-lock",
            link: "/goals",
            click: function (e: any) {
                e.preventDefault();
                history("/goals");
                setIscurrentState('Goals');
            },
        },
        {
            label: "Plan",
            isHeader: true,
        },
        {
            id: "budget",
            label: "Budget",
            icon: "bx bx-pie-chart-alt",
            link: "/budget",
            click: function (e: any) {
                e.preventDefault();
                history("/budget");
                setIscurrentState('Budget');
            },
        },
        {
            id: "forecast",
            label: "Forecast",
            icon: "bx bx-line-chart",
            link: "/forecast",
            click: function (e: any) {
                e.preventDefault();
                history("/forecast");
                setIscurrentState('Forecast');
            },
        },
        {
            id: "calendar",
            label: "Financial Calendar",
            icon: "bx bx-calendar",
            link: "/financial-calendar",
            click: function (e: any) {
                e.preventDefault();
                history("/financial-calendar");
                setIscurrentState('Calendar');
            },
        },
        {
            label: "Settings",
            isHeader: true,
        },
        {
            id: "notifications",
            label: "Notifications",
            icon: "bx bx-bell",
            link: "/notification-settings",
            click: function (e: any) {
                e.preventDefault();
                history("/notification-settings");
                setIscurrentState('Notifications');
            },
        },
        {
            id: "profile",
            label: "Profile",
            icon: "bx bx-user",
            link: "/profile",
            click: function (e: any) {
                e.preventDefault();
                history("/profile");
                setIscurrentState('Profile');
            },
        },
    ];

    return <React.Fragment>{menuItems}</React.Fragment>;
};

export default Navdata;