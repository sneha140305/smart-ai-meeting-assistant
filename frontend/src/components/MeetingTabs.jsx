export default function MeetingTabs({
  tabs,
  activeTab,
  onChange
}) {
  return (
    <div className="border-b border-gray-200">

      <div className="flex gap-1 overflow-x-auto">

        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              whitespace-nowrap
              border-b-2
              px-4
              py-3
              text-sm
              font-medium
              transition
              ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }
            `}
          >
            {tab.label}
          </button>
        ))}

      </div>

    </div>
  );
}